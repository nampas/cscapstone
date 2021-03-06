/**
 * Created by Nathan P on 1/25/14.
 *
 * This starts the server.
 * In the command line from /server, run:
 *    node scripts/server_main.js
 */

// This will be the only dependency we specify using node module syntax. From
// this point on we use requirejs syntax.
var requirejs = require('requirejs');

requirejs.config({
    //Pass the top-level main.js/index.js require
    //function to requirejs so that node modules
    //are loaded relative to the top-level JS file.
    nodeRequire: require,
    baseUrl: "./scripts",

    paths: {
        config: '../../config.json',
		clipper: 'utils/clipper-min',
		text: '../../client/scripts/lib/text',
		json: '../../client/scripts/lib/json'
    },

	config: {
		text: {
			env: 'node'
		}
	}
});

// Start the server
requirejs(['server',
    'utils/services'
], function (server, services) {

    // Only start services if specified
    process.argv.forEach(function (val) {
        if(val === "--services")
            services.startServices();
    });

    // But always start the server
    server.start();
});
