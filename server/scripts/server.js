/**
 * Created by Nathan P on 1/24/14.
 */

define(['http',
    'url',
    'fs',
    'express',
    'routers/router',
    'routers/gtfsRouter',
], function (http, url, fs, express, router, gtfsRouter) {

    // Starts the server
    function start() {

        console.log("server : server has started");

        var app = express();

        app.use(express.logger());
        app.use(express.cookieParser());
        app.use(express.session({secret: '1234567890QWERTY'}));
        app.use(express.bodyParser({limit: '5mb'}));
        // Express will serve up anything in the following folders as static
        // assets
        app.use(express.static('scripts'));  
        app.use(express.static('../'));        
        app.use(express.static('../client/scripts'));
		app.use(express.static('../client/assets'));
        app.use(express.static('../client/templates'));

        // app.VERB methods are strung together as middleware.
        // Check this out for a good explanation of the framework:
        // http://evanhahn.com/understanding-express-js/
        app.get('/', function (req, res) {
            // Serve the homepage asynchronously
            res.writeHead(200, {'Content-Type': 'text/html'});
            fs.readFile("../client/assets/index.html",
                'utf-8',
                function (error, html) {
                    if (error)
                    // uh oh, where's the index file?
                        throw error;
                    res.end(html);
                });
        });

        // All saves/fetches for the simulation model
        app.all('/sim_session/*', function(req, response) {
            router.simSession(req, response);
        });

        app.all('/route_sync/*', function(req, response) {
            router.routeSync(req, response);
        });

        app.all(/^\/update_ridership/, function(req, response) {
            gtfsRouter.updateRidershipRoute(req, response);
            console.log("got update ridership request");
        });

        app.all(/^\/city_session_auth/, function(req, response){
            router.routeAuth(req, response);
        });

        app.all(/^\/new_stop/, function(req, response){
            router.newStop(req, response);
        });

        app.listen(80);
    }


    // This is the requirejs "export". Anything returned constitutes what other
    // scripts can do with this module.
    return {
        start: start // the start function
    };
});
