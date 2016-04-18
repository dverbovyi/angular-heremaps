module.exports = function(MarkerInterface){
    function DefaultMarker(place){
        this.place = place;
        this.setCoords();
    }

    // TODO: Object create should have pollyfill
    var proto = DefaultMarker.prototype = Object.create(MarkerInterface.prototype);
    proto.constructor = DefaultMarker;

    proto.create = function(){
        return new H.map.Marker(this.coords);
    }

    return DefaultMarker;
}