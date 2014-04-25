/**
 * Created by Nathan P on 4/18/2014.
 */

define(['fs',
    'url',
    'path',
    'child_process',
    'http',
    'adm-zip',
    'scripts/utils/globalvars',
    'scripts/database/connect',
    'scripts/utils/multimodalRoutingAPI'
], function(fs,
            url,
            path,
            childProcess,
            http,
            AdmZip,
            globalvars,
            connect,
            multimodalRoute) 
{
    function updateRidershipRoute(request, response) {

        var query = request.query;
        var body = request.body;
        var geoID = query.state + query.place;

        connect.makeSessWrite(query.session, 
                                body.routes, 
                                geoID, 
                                null, 
                                body.gtfs, 
                                function(result) {

        });

        // Update the graph with new GTFS
        updateOTPGraph(request, function(sessionDir) {

            // We also need to link the OTP graphs folder, because it's
            // not letting us change the base path. Stupid!
            var pathToOtpGraph = path.join(globalvars.otpGraphPath, request.query.session);
            var pathToOSMGraph = path.join(sessionDir, 'Graph.obj');
            var to = path.join(pathToOtpGraph, 'Graph.obj'); // To here

            // So make a directory for this session and symlink the OSM graphh
            fs.mkdir(pathToOtpGraph, 0777, function() {
                console.log(pathToOSMGraph + " " + to);
                childProcess.exec('ln ' + pathToOSMGraph + ' ' + to, {},
                    function(err, stdout, stderr) {
                        if(err)
                            console.log(stderr);

                        // Inform OTP server of new graph
                        multimodalRoute.reloadRoute(request.query.session, function() {
                            // Everything is ready! Do routing
                            doUpdateRidership(request.query, body.routes);
                        });
                    }
                );
            });
        });

        response.send();
    }

    function writeRiderDB(request, callback) {
        // TODO
        callback.call(this, true);
    }

    function updateOTPGraph(request, callback) {

        var dir = path.join(globalvars.sessionsDir, request.query.session);

        // Make directory to the session
        fs.mkdir(dir,0777,function() {

            // Write the gtfs file to this session's directory
            writeAndZipGtfs(dir, request.body.gtfs);

            // Link the appropriate OSM map to this session's directory
            linkOsmMap(request.query.state, request.query.session, dir,
                function() {
                    // Rebuild the graph with the new GTFS feed
                    var child = childProcess.spawn('java', [
                    '-Xmx2g',
                    '-jar',
                    globalvars.otpJarPath,
                    '--build',
                    dir]);

                    child.stdout.on('data', function (data) {
                        console.log('child: ' + data);
                    });

                    child.stderr.on('data', function (data) {
                        console.log('child: ' + data);
                    });

                    child.on('close', function(code) {
                        console.log('Graph compilation finished with exit code: ' + code);
                        callback.call(this, dir);
                    });
            });
        });
    }

    function writeAndZipGtfs(dir, gtfsJson) {

        var zip = new AdmZip();
        // Add all files to the zip buffer. The key is the correct file name
        for (var key in gtfsJson)
            zip.addFile(key, new Buffer(gtfsJson[key]));

        var gtfsZip = path.join(dir, 'gtfs.zip');
        console.log("Writing gtfs zip at " + gtfsZip);
        zip.writeZip(gtfsZip);
    }

    function linkOsmMap(stateID, session, sessionDir, callback) {
        // Find the osm file corresponding to the state to the session directory
        fs.readdir(globalvars.osmDir, function(err, files) {
            if(err)
                throw err;

            for(var i = 0; i < files.length; i++) {
                if(RegExp('^' + stateID).test(files[i])) {

                    // Create a link from the OSM file location to the session
                    // folder. OTP needs the GTFS and OSM in the same folder
                    var from = path.join(globalvars.osmDir, files[i]); // Linking from here
                    var to = path.join(sessionDir, stateID + '.osm.pbf'); // To here
                    console.log(from + "   " + to);

                    childProcess.exec('ln ' + from + ' ' + to, {},
                        function(err, stdout, stderr) {
                            if(err)
                                console.log(stderr);

                            callback.call(this, to);
                        }
                    );
                }
            }
            console.log("NO OSM DATA FOUND FOR STATE " + stateID);
        });
    }

    function doUpdateRidership(query, transitRoutes) {

        var geoID = query.state + query.place;
        var tripsCompleted = 0;

        // Get all the trips
        connect.makeTripQuery(geoID, function(trips) {
            if(trips === false) {
                console.log('NO TRIPS FOUND FOR GEOID ' + geoID);
            } else {
                console.log("Updating ridership...");
                resetRidership(transitRoutes);
                for(var i = 0; i < trips.length; i++) {
                    routeAPIWrapper(query.session, trips[i], function(trip, result) {

                        handleRouteResponse(trip, result, transitRoutes);

                        // Evict the graph when finished to reduce memory
                        // footprint, and write the updated route collection to
                        // the db
                        if(++tripsCompleted === trips.length) {
                            multimodalRoute.evictRoute(query.session);
                            // TODO update routes in DB
                        }
                    });
                }
            }
        }, this);        
    }

    function resetRidership(transitRoutes) {
        // Reset global ridership numbers
        transitRoutes.unsatisfied = 0;
        transitRoutes.satisfied = 0;

        // Reset ridership numbers for each route
        var routes = transitRoutes.models;
        for(var i = 0; i < routes.length; i++) {
            routes[i].attributes.ridership = 0;
        }
    }

    function handleRouteResponse(trip, result, transitRoutes) {
        var itineraries = result.plan.itineraries;
        var bestRoute = null;
        // Get the quickest route
        for(var i = 0; i < itineraries.length; i++) {
            if(bestRoute === null
                || bestRoute.duration > itineraries[i].duration)
                bestRoute = itineraries[i];
        }

        // If there is no route, update total of unsatisfied trips
        if(bestRoute === null) {
            ++transitRoutes.unsatisfied;
        // If there was a valid route, update total of satisfied trips
        } else {
            ++transitRoutes.satisfied;

            // Loop through all trip legs, keeping track of which transit routes
            // were used
            var legs = bestRoute.legs;
            for(var i = 0; i < legs.length; i++) {
                var curLeg = legs[i];
                if(curLeg.mode !== 'WALK') {
                    // Increment ridership count for the route on which this
                    // leg occurred
                    var routeId = curLeg.routeId;
                    var routes = transitRoutes.models;
                    for(var i = 0; i < routes.length; i++) {
                        if(routes[i].attributes.id == routeId) {
                            ++routes[i].attributes.ridership;
                            break;
                        }
                    }
                }
            }
        }
    }

    /**
     * Wraps the multimodal routing API, so that we can hold on to
     * references to the trip (otherwise we'd lose them in the async
     * for loop of doUpdateRidership() )
     */
    function routeAPIWrapper(session, trip, callback) {
        multimodalRoute.doRoute(session, 
                                trip.origin.coordinates, 
                                trip.dest.coordinates,
                                function(result) 
        {
            callback.call(this, trip, result);
        }, this);
    }

    return {
        updateRidershipRoute: updateRidershipRoute
    }
});