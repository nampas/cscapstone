/**
 * Created by Nathan P on 1/24/14.
 */

define(['http',
    'url',
    'fs',
    'express',
    'scripts/utils/censusAPI',
    'scripts/utils/googlestaticAPI'
], function (http, url, fs, express, censusAPI, googleStaticAPI) {

    // Starts the server with a router instance
    function start(route) {
        console.log("server : server has started");

        var app = express();

        app.use(express.logger());
        app.use(express.cookieParser());
        app.use(express.session({secret: '1234567890QWERTY'}));
        app.use(express.bodyParser({limit: '5mb'}));
        // Express will serve up anything in the following folders as static
        // assets
        app.use(express.static('scripts'));
        app.use(express.static('assets'));
        app.use(express.static('templates'))

        // app.VERB methods are strung together as middleware.
        // Check this out for a good explanation of the framework:
        // http://evanhahn.com/understanding-express-js/
        app.get('/', function (req, res) {
            // Serve the homepage asynchronously
            res.writeHead(200, {'Content-Type': 'text/html'});
            fs.readFile("index.html",
                'utf-8',
                function (error, html) {
                    if (error)
                    // uh oh, where's the index file?
                        throw error;
                    res.end(html);
                });
        });

        app.get('/map', function (req, res) {
            // Serve the homepage asynchronously
            res.writeHead(200, {'Content-Type': 'text/html'});
            fs.readFile("./map/index.html",
                'utf-8',
                function (error, html) {
                    if (error)
                    // uh oh, where's the index file?
                        throw error;
                    res.end(html);
                });
        });

        // All our API calls end up here
        app.get('/api/*', function(req, res) {

        });

        // All saves/fetches for the simulation model
        app.all('/sim_session/*', function(req, response) {
//            response.writeHead(200, {'Content-Type': 'application/json'});

            // A put means this is a new model. We nee to do all the initializing
            // stuff, including setting the city, getting all geo, and generating
            // trips
            if(req.route.method === 'put') {
                console.log('handling put');

                var cityModel = req.body.city;

                // get the city name, boundary and centroid
                censusAPI.getBoundaryLocation(req.body.location, function(res) {
                    if(res !== false) {
                        var geoObj = res.objects[0];
                        cityModel.cityName = geoObj.metadata.NAME10;
                        console.log('setting name: ' + cityModel.cityName);
                        // swap lat/lng for consistency
                        cityModel.centroid = [geoObj.centroid.coordinates[1],
                                                geoObj.centroid.coordinates[0]];
                        console.log('setting centroid: ' + cityModel.centroid.toString());

                        // get the timezone
                        googleStaticAPI.getTimezone(req.body.location,
                            function(res) {
                                if(res !== false) {
                                    cityModel.timezone = res.timeZoneId;
                                    console.log('setting tz: ' + cityModel.timezone);

                                    // TODO toString -> parse is circuitous
                                    var results = {
                                        city: cityModel,
                                        sessionID: req.sessionID
                                    };

                                    // Send back the modified body
                                    response.send(JSON.stringify(results));
                                    console.log('sent end');
                                } else {
                                    response.writeHead(404);
                                    response.send();
                                }
                            }, this);
                    } else {
                        response.writeHead(404);
                        response.send();
                    }
                }, this);

            } else if(req.route.method === 'post') {
                console.log('handle post');
            }


        });

        app.listen(1337, '127.0.0.1');
    };


    // This is the requirejs "export". Anything returned via define()
    // constitutes what other scripts can do with this module.
    return {
        start: start // the start function
    };
});