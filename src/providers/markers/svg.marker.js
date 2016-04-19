module.exports = function(MarkerInterface){
    function SVGMarker(place){
        this.place = place;
        this.setCoords();
    }
    
    var proto = SVGMarker.prototype = new MarkerInterface();
    
    proto.constructor = SVGMarker;
    
    proto.create = function(){
        return new H.map.Marker(this.coords, {
            icon: this._getIcon(),
        });
    };
    
    proto._getIcon = function(){
        var icon = this.place.markup;
         if(!icon)
            throw new Error('markup missed');

        return new H.map.Icon(icon);
    };
    
    return SVGMarker;
}