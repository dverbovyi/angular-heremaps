module.exports = function(MarkerInterface){
    function DOMMarker(place){
        this.place = place;
        this.setCoords();
    }
    
    var proto = DOMMarker.prototype = Object.create(MarkerInterface.prototype);
    proto.constructor = DOMMarker;
    
    proto.create = function(){
        return new H.map.DomMarker(this.coords, {
            icon: this._getIcon(),
        });
    };
    
    proto._getIcon = function(){
        var icon = this.place.icon;
        console.log(this.place)
         if(!icon)
            throw new Error('Icon missed');
            
        return new H.map.DomIcon(icon, this._getEvents());
    };
    
    proto._setupEvents = function(el, events, remove){
        var method = remove ? 'removeEventListener' : 'addEventListener';
        
        for(var key in events) {
            if(!events.hasOwnProperty(key))
                continue;
                
            el[method].call(null, key, events[key]);
        }
    };
    
    proto._getEvents = function(){
        var self = this,
            events = this.place.events;
             
        if(!this.place.events)
            return {};
            
        return {
            // the function is called every time marker enters the viewport
            onAttach: function(clonedElement, domIcon, domMarker){
                self._setupEvents(clonedElement, events);
            },
             // the function is called every time marker leaves the viewport
            onDetach: function(clonedElement, domIcon, domMarker){
                self._setupEvents(clonedElement, events, true);
            }
        }
    };
    
    return DOMMarker;
}