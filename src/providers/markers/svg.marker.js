module.exports = function(MarkerInterface){
    function SVGMarker(place){
        this.place = place;
        this.setCoords();
    }
    
    var proto = SVGMarker.prototype = new MarkerInterface();
    proto.constructor = SVGMarker;
    
    proto.create = create;
    proto._getIcon = _getIcon;
    
    return SVGMarker;
    
    function create(){
        var marker = new H.map.Marker(this.coords, {
            icon: this._getIcon(),
        });
        
        this.addInfoBubble(marker);
        
        return marker;
    }
    
    function _getIcon(){
        var icon = this.place.markup;
         if(!icon)
            throw new Error('markup missed');

        return new H.map.Icon(icon);
    }
}