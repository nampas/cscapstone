/**
 * Created by Nathan P on 4/7/14.
 */
define(['backbone',
    'underscore',
    'text!NetworkStatsTemplate.ejs'
], function(backbone, _, networkStatsTemplate) {

    var NetworkStatsView = Backbone.View.extend({

        rendered: false,

        initialize: function() {

            // Listen for changes in the route collection
            this.collection.on('add', this.updateRoutes, this);
            this.collection.on('remove', this.updateRoutes, this);

            var that = this;
            $(document).on('click', ".delete-route-btn", function(event) {
                var id = event.target.id;
                // Remove the specified route from the collection
                console.log('removing route of id ' + id);
                that.collection.remove(id);
            });

            this.updateRoutes();

            // Listen for events fired when the in focus tab changes. These
            // events are fired by the CtrlSelectorView
            Backbone.pubSub.on('ctrl-tab-change', function(id) {
                if(id === 'nav-tab-stats' && !this.rendered)
                    that.render();
                else if(id !== 'nav-tab-stats')
                    that.remove();
            });

			// Listen for the addition of new stops so we can update
			// the system cost
			Backbone.pubSub.on('new-transit-stop', function() {
				that.updateRoutes();
			});
        },

        render: function() {
            // Load the compiled HTML into the Backbone "el"
            this.$el.html( this.template );

            $('#ctrl-container').append(this.$el);
            this.rendered = true
        },

        remove: function() {
            this.$el.remove();
            this.rendered = false;
        },

        updateRoutes: function() {
            console.log("Updating routes");
            var routes = [];
            var numRoutes = this.collection.length;
            for(var i = 0; i < numRoutes; i++) {
                var route = this.collection.at(i);
				var revenueHrs = route.getRevenueHours();
				if(revenueHrs > 0)
					revenueHrs = (route.get('ridership') / revenueHrs).toFixed(2);
                var routeObj = {
                    name: route.get('name'),
                    ridership: revenueHrs,
                    color: route.get('geoJson').properties.color,
                    mode: route.get('mode').get('typeString'),
                    id: route.get('id')
                }
                routes.push(routeObj);
            }
	    
            var globalStats = {
                pctDemandSatisfied: this.collection.totalPctSatisfied.toFixed(2),
				systemCost: this.collection.getSystemCost().toFixed(2)
            }

            // Compile the template, and pass in the layer list
            this.template = _.template(networkStatsTemplate,
                {routes: routes,
                globalStats: globalStats});

            // Only re-render if the view is already visible
            if(this.rendered)
                this.render();
        }
    });

    return NetworkStatsView;

});
