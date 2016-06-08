/**
 * Created by Dmytro on 4/11/2016.
 */

describe('Here Maps directive', function () {
    var scope, $compile, $rootScope,
        template = angular.element('<div heremaps></div>');

   angular.mock.module('heremaps');

    beforeEach(inject(['$compile', '$rootScope', function (_$compile_, _$rootScope_) {
        $compile = _$compile_;
        $rootScope = _$rootScope_;
        $scope = $rootScope.$new();
    }]
    ));

    it('Should render a map', function () {
        var result = $compile('<div heremaps></div>')($scope);
         $scope.$digest();
         
         console.log(result)
        expect(result.find('canvas').length).toBe(1);
    });
});
