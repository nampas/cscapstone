/**
 * Created by Nathan P on 1/25/14.
 *
 * The flow of logic here might be confusing
 *      ---------------------
 *      getBoundaryLocation()
 *      - gets geodata associated with the lat/lng arg
 *          |
 *          getCensusTractPopulations()
 *          - gets the populations broken down by census tract in the place
 *              |
 *              getCityTractGeo()
 *              - returns a GeoJson containg shapes of all census tracts in
 *                the place, along with population and employment density *
 *      -------------------
 *      getStateTracts()
 *      - gets timezone for specified lat/lng
 *
 * Each of these methods checks if it's the last to complete. Only then is the
 * HTTP response sent
 */

define(['scripts/utils/censusAPI',
    'scripts/utils/googleStaticAPI',
    'fs',
    'scripts/models/citytracts'
], function(censusAPI, googleStaticAPI, fs, cityTracts) {

    var completedSteps;

    function checkCallsFinished(request, response, cityModel) {

        // Wait until all steps have completed
        for(var step in completedSteps) {
            if(completedSteps[step] === false) {
                return;
            }
        }

        var results = {
            city: cityModel,
            sessionID: request.sessionID
        };

        // Send back the modified body
        response.send(JSON.stringify(results));
        console.log('sent sim session response');
    }

    function onBoundaryResponse(cityModel, request, appResponse, geoObj, context) {

        if(geoObj === false) {
            console.log("boundary fails");
            appResponse.writeHead(404);
            appResponse.send();
            return;
        }

        cityModel.cityName = geoObj.cityName;
        cityModel.centroid = geoObj.centroid;
        cityModel.stateID = geoObj.stateID;
        cityModel.placeID = geoObj.placeID;
        console.log('setting geo data: \r\n ' + JSON.stringify(geoObj));

        cityTracts.getCityTractsGeo(cityModel.stateID, cityModel.placeID,
            function(result) {
                // TODO handle city geo json
                cityModel.censusTracts = result.cityTracts;
                cityModel.boundary = result.cityBoundary;
                completedSteps.cityTracts = true;
                checkCallsFinished(request, appResponse, cityModel)
            }, this);
    }

    function onCensusTractPopResponse(cityModel, request,
                                      appResponse, cityPops, context) {

        if(cityPops === false) {
            completedSteps.cityTracts = true;
            checkCallsFinished(request, appResponse, cityModel);
            return;
        }

        cityTracts.getCityTractsGeo(cityModel.stateID, cityModel.countyID,
            cityModel.placeID, cityPops, function(geoJson) {
                // TODO handle city geo json
                cityModel.censusTracts = geoJson;
                completedSteps.cityTracts = true;
                checkCallsFinished(request, appResponse, cityModel);
            }, this);
    }

    function onStateTractResponse(cityModel, request, appResponse, res, context) {
        if(res === false) {
            console.log("error retrieving state census tractrs")
        } else {
            console.log('got state tract callback, file length ' + res.length);
            fs.writeFile('./tract.zip', res, function(err) {
                if(err)
                    console.log("error writing file")
                else
                    console.log("file saved");
            });
        }



        completedSteps.stateTracts = true;
        checkCallsFinished(request, appResponse, cityModel)
    }

    function simSessionRoute(request, response) {

        // keep track of how many calbacks have returned
        completedSteps = {
            timezone: false,
            cityTracts: false
        };

        var that = this;
        // A put means this is a new model. We nee to do all the initializing
        // stuff, including setting the city, getting all geo, and generating
        // trips
        if(request.route.method === 'put') {
            console.log('handling put');

            var cityModel = request.body.city;

            // get the city name, boundary and centroid
            censusAPI.getBoundaryLocation(cityModel.location, function(res) {
                onBoundaryResponse(cityModel, request, response, res, that);
            }, this);

            // get the timezone
            googleStaticAPI.getTimezone(cityModel.location, function(res) {
                if(res === false) {
                    console.error("TZ fails");
                    // TODO error handling
                } else {
                    // If successful, grab the timezone
                    cityModel.timezone = res.timeZoneId;
                    console.log('Setting TZ: ' + cityModel.timezone);
                }
            	completedSteps.timezone = true;
            	checkCallsFinished(request, response, cityModel);
            }, this);

        } else if(req.route.method === 'post') {
            console.log('handle post');
        }
    }

    // These are the exports
    return {
        simSession: simSessionRoute
    };

});
