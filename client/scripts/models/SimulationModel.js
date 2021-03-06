/**
 * Created by Nathan P on 2/11/14.
 *
 * This is the beast, keeps track of an entire simulation instance
 */

define(['backbone',
    'underscore',
    'models/TransitRouteModel',
    'models/Sim2GtfsModel',
    'collections/TransitRouteCollection',
    'models/BusModeModel',
    'models/CityModel',
    'views/ChooseCityView',
    'views/MapView',
    'views/MapLayerCtrlView',
    'views/HeaderView',
    'views/CtrlSelectorView',
    'views/CityLoadingView',
    'views/NetworkStatsView',
    'views/ChooseCitySessionView',
    'views/UpdateRidershipView'
], function(Backbone,
            _,
            TransitRoute,
            Sim2Gtfs,
            TransitRouteCollection,
            BusMode,
            CityModel,
            ChooseCityView,
            MapView,
            MapLayerCtrlView,
            HeaderView,
            CtrlSelectorView,
            CityLoadingView,
            NetworkStatsView,
            ChooseCitySessionView,
            UpdateRidershipView)
{
    var SimulationModel = Backbone.Model.extend({

        defaults: {
            'sessionID': null,
            'transitRoutes': null,
            'sim2Gtfs': null,
            'city': null
        },

        initialize: function() {

            Backbone.pubSub = _.extend({}, Backbone.Events);

            this.urlRoot = '/sim_session';
            this.id = this.cid;

            var transitRoutes = new TransitRouteCollection();
            var city = new CityModel();

            this.set({'transitRoutes': transitRoutes,
                        'city': city});

            this.set({"layers" : {
                    popLevels: {name: "Population Levels",
                                toggled: false},
                    empLevels: {name: "Employment Levels",
                                toggled: false},
                    transitNet: {name: "Transit Network",
                                toggled: true}}
            });

            // add in the header
            new HeaderView({'model': this}).render();

            // and the city selector
            var chooseCity = new ChooseCityView({'model': this});
            chooseCity.render();

            // and the map
            var mapView = new MapView({'model': this});
            mapView.initMap();

            // and the city session selection
            new ChooseCitySessionView({'model': this}).render();

        },

        // Called from the ChooseCityView, once the user has entered a location
        // and it has been geocoded. Now we need to convert the long/lat
        // coordinates to a city and state code
        setLocation: function(longLat) {

            new CityLoadingView({'model': this}).render();

            this.get('city').set({'location': longLat});

            // Now that we've set the location, the server can do the rest.
            // But tell the server what needs changing. In particular, set the
            // city!
            var that = this;
            var response = this.save(['city', 'sessionID'], {
                success: function() {
                    console.log('model persisted, id and city info updated');
                    
                    var cityJSON = that.get('city');
                    that.set({'city': new CityModel(cityJSON)});
                    that.onSessionStart(true);
                },
                error: function (model, response, options) {
                    console.log('persist fails');
                }
            });
            console.log(response);
        },

        onSessionStart: function(isNew) {
            // add the control selector
            new CtrlSelectorView().render();

            // and the map layer selector and render it by default
            new MapLayerCtrlView({'model': this}).render();

            // and the network stats
            new NetworkStatsView({'collection': this.get('transitRoutes')});

            // and the ridership update view
            new UpdateRidershipView({'model': this}).render();

            if(isNew)
                this.initSim2Gtfs();
        },

        initSim2Gtfs: function() {
            var timezone = this.get('city').get('timezone');
            var routes = this.get('transitRoutes');
            var sim2Gtfs = new Sim2Gtfs({'transitRoutes': routes,
                                         'timezone': timezone});
            this.set({'sim2Gtfs': sim2Gtfs});
        },

        onCitySessionSelected: function(sessionName, isNew, callback, context) {
            var url = '/city_session_auth?new=' + isNew
                                + '&session='  + sessionName;

            var that = this;
            $.ajax({
                url: url,
                type: 'GET',
                success: function(data, status, jqXHR) {

                    var success = false;
                    // User requests a new session name, and session name is
                    // unique
                    if(isNew && data.code === 1) {
                        success = true;	
                        that.set({'sessionName': sessionName}); 
                    // User requests a load, and session exists on the server
                    } else if(!isNew && data.code !== 1) {
                        success = true;
                        that.set({'sessionName': sessionName}); 
                        that.handleSessionRestore(JSON.parse(data));
                    }

                    callback.call(context||that, success);
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    console.log("error: " + textStatus + '\r\n' + errorThrown);
                    callback.call(context||that, false);
                }
            });
        },

        handleSessionRestore: function(restoredData) {
            console.log("handling session restore");

            // Add city data to the city model
            var cityModel = this.get('city');
            cityModel.set(restoredData.city);

            // Instantiate transit routes and add to the route collection
            this.get('transitRoutes').handleRoutesRestore(restoredData.routeCollection);

            var sim2Gtfs = new Sim2Gtfs({'transitRoutes': this.get('transitRoutes'),
                                        'timezone': cityModel.get('timezone')});
            this.set({'sim2Gtfs': sim2Gtfs});
            sim2Gtfs.handleGtfsRestore(restoredData.gtfs);

            Backbone.pubSub.trigger('session-restore');
            this.onSessionStart(false);
        } 
    });

    return SimulationModel;
});
