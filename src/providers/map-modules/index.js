var eventsModule = require('./events/events.js'),
    infoBubble = require('./events/infobubble.js');
    
var uiModule = require('./ui/ui.js');

angular.module('events-module', [])
    .factory('EventsModule', eventsModule)
    .factory('InfoBubbleFactory', infoBubble);
    
angular.module('ui-module', [])
    .factory('UIModule', uiModule)

var app = angular.module('map-modules', [
	'events-module',
    'ui-module'
]);

module.exports = app;