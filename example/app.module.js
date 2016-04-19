
(function() {

    'use strict';


    angular.module('exampleModule', ['heremaps']);

    angular.module('exampleModule')
        .controller('AppCtrl', ['$scope', AppController]);

    function AppController($scope) {
        // TODO: Dont use numbers for marker type
        
        $scope.events = {
            'click': function(e) {
                console.log('click event', e)
            }
        };
        
        $scope.markers = [
            {
                pos: { lat: 52.508249, lng: 13.338931 },
                draggable: true
            },
            {
                pos: { lat: 52.506682, lng: 13.332107 },
                type: 2,
                draggable: true,
                markup: '<svg  width="35" height="24" xmlns="http://www.w3.org/2000/svg">' +
                '<rect stroke="black" fill="red" x="1" y="1" width="35" height="24" />' +
                '<text x="18" y="18" font-size="12pt" font-family="Arial" font-weight="bold" ' +
                'text-anchor="middle" fill="green">SVG</text></svg>',
            },
            {
                pos: { lat: 52.503730, lng: 13.331678 },
                type: 1,
                markup: '<div style="width: 35px; height: 20px; background-color: red">DOM</div>',
            },
            {
                pos: { lat: 52.531, lng: 13.380 }
            }
        ]
    }
})();


