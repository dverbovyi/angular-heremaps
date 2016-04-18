
(function() {
    
    'use strict';
    
    
    angular.module('exampleModule', ['heremaps']);
    
    angular.module('exampleModule')
        .controller('AppCtrl', ['$scope', AppController]);  

    function AppController($scope) {
         $scope.markers = [
             {
                 pos: { lat: 52.508249, lng: 13.338931 }
             },
             {
                 pos: { lat: 52.506682, lng: 13.332107 },
                 draggable: true
             },
             {
                 pos: { lat: 52.503730, lng: 13.331678 },
                 type: 1,
                 draggable: true,
                 icon: '<div style="width: 50px; height: 30px; background-color: red">ICON</div>',
                 events: {
                     'click': function(e) {
                         console.log('dom marker has been clicked', e)
                     }
                 }
             },
             {
                 pos: { lat: 52.531, lng: 13.380 }
             }
         ]
    }
})();


