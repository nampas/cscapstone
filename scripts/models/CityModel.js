/**
 * Created by Nathan P on 2/27/14.
 */

define(['backbone',
    'underscore',
], function(Backbone, _) {

    var CityModel = Backbone.Model.extend({

        defaults: {
            'cityName': 'AmericanCity',
            // geoIDs, as specified by the census bureau
            'stateID': null,
            'countyID': null,
            'countySubdivID': null,
            'placeID': null,
            // Default to US Central time. Tz strings are specified here:
            // http://en.wikipedia.org/wiki/List_of_tz_zones
            'timezone': 'America/Chicago',
            'centroid': null,
            'censusTracts': null,
            'boundary': null
        },

        initialize: function() {
            this.on('change:centroid', this.setTimezone, this);
        },

        setTimezone: function() {
            var centroid = this.get('centroid');
            if(centroid === null) {
                return;
            }
            // Can't do cross domain calls. Ask our server for the timezone,
            // which will in turn ask google
            $.get('/api/tz?loc=' + centroid[0] + ',' + centroid[1],
                function(data) {
                    this.set({'timezone': data});
            });
        }
    });

    return CityModel;
});