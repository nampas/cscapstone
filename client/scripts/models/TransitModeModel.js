/**
 * Created by Nathan P on 2/13/14.
 */

define(['backbone',
    'underscore'
], function (Backbone, Underscore) {

    var TransitModeModel = Backbone.Model.extend({
        defaults: {
            // Mode type code, this should correspond to GTFS mode values
            // defined in the route_type field at:
            // https://developers.google.com/transit/gtfs/reference#routes_fields
            'typeString': {
                0: 'tram',
                1: 'subway',
                2: 'rail',
                3: 'bus',
                4: 'ferry',
                5: 'cable car',
                6: 'gondola',
                7: 'funicular',
                'tram': 0,
                'subway': 1,
                'rail': 2,
                'bus': 3,
                'ferry': 4,
                'cable car': 5,
                'gondola': 6,
                'funicular': 7
            },
            'type': null,
            'typeString': null,
            'dwellTime': null
        },

        getModeString: function(modeCode) {
            return this.get('typeString')[modeCode];
        }
    });

    return TransitModeModel;
});