function Room(roomId, session, token, chattr){
  this.roomId = roomId;
  this.session = session;
  this.token = token;
  this.chattr = chattr;
  this.filterData = {};
  this.unseenCount = 0;
  this.initialized = false;
  this.recording = false;
  this.initOT();
  this.init();
}
Room.prototype = {
  constructor: Room,
  init: function(){
    var self = this;
    window.onresize = self.layout;
    $("#chatButton").click(function(){
      $("#chattr").toggle();
      self.unseenCount = 0;
      $("#chatButton").addClass("no-after");
    });
    $("#recordButton").click(function(){
      $(this).toggleClass("selected");
      var actionVerb, nextAction;
      if($(this).hasClass("selected")){
        self.triggerActivity("record","start");
        actionVerb = "started";
        nextAction = "Stop";
      } else{ 
        self.triggerActivity("record","stop");
        actionVerb = "stopped";
        nextAction = "Start";
      }
      $("#recordButton").data('tooltip').options.title=nextAction+" Recording";
    });
    $(document.body).on("click","#filtersList li button",function(){
      $("#filtersList li button").removeClass("selected");
      var prop = $(this).data('value');
      console.log(prop);
      self.applyClassFilter( prop, "#myPublisher" );
      $(this).addClass("selected");
      self.sendSignal( "filter", {cid: self.session.connection.connectionId, filter: prop });
      self.filterData[self.session.connection.connectionId] = prop;
    });
  },
  initOT: function(){
    console.log(this);
    var _this = this;
    var session = this.session;
    session.connect(this.token, function(error){
      var publisher = OT.initPublisher( "<%= apiKey %>", "myPublisher", {width:"100%", height:"100%"} );
      session.publish( publisher );
      setTimeout(function(){_this.initialized = true;}, 2000);
    });
    session.on("streamCreated", function(event){
      var streamConnectionId = event.stream.connection.connectionId;
      console.log("STREAM CREATED");
      // create new div container for stream, subscribe, apply filter
      var divId = "stream" + streamConnectionId;
      console.log(_this);
      $("#streams_container").append(
         _this.userStreamTemplate({ id: divId, connectionId: streamConnectionId }) );
      var subscribers = [];
      subscribers[ streamConnectionId ] = session.subscribe( event.stream, divId , {width:"100%", height:"100%"} );
      _this.layout();
    });
    session.on("streamDestroyed", function(event){
      _this.removeStream(event.stream.connection.connectionId);
      _this.layout();
    });
    session.on("connectionCreated", function(event){
      console.log("CONNECTION CREATED YAY");
      if(_this.initialized){
        console.log("ABOUT TO SEND SIGNAL");
        var dataToSend = {"filterData": _this.filterData};
        if(_this.archiveId && $(".controlOption[data-activity=record]").hasClass("selected")){
          dataToSend.archiveId = _this.archiveId;
        }
        _this.sendSignal("initialize", dataToSend, event.connection);
      }
    });
    session.on("signal", function(event){
      var data = JSON.parse( event.data );
      switch(event.type){
        case "signal:initialize":
          if(!_this.initialized){
            _this.filterData = data.filterData;
            _this.applyAllFilters();
            if(data.archiveId){
              _this.archiveId = data.archiveId;
              $(".controlOption[data-activity=record]").addClass('selected');
              $("#recordButton").data('tooltip').options.title="Stop Recording";
            }
            _this.initialized = true;
          }
          break;
        case "signal:archive":
          var actionVerb, newAction;
          if(data.action === "start"){
            actionVerb = "started";
            newAction = "Stop";
            $(".controlOption[data-activity=record]").addClass('selected');
          } else{
            actionVerb = "stopped";
            newAction = "Start";
            $(".controlOption[data-activity=record]").removeClass('selected');
          }
          $("#recordButton").data('tooltip').options.title=newAction+" Recording";
          _this.archiveId = data.archiveId;
          var archiveUrl = window.location.origin +"/archive/"+_this.archiveId+"/"+_this.roomId;
          console.log("ARCHIVING");
          var msg = {"type": "generalUpdate", "data":{"text":"Archiving for this session has "+actionVerb+". View it here: <a href = '"+ archiveUrl+"'>"+archiveUrl+"</a>"}};
          _this.chattr.messages.push(msg);
          _this.chattr.printMessage(msg);
          break;
        case "signal:filter":
          _this.filterData[data.cid] = data.filter;
          _this.applyClassFilter(data.filter, ".stream"+data.cid);
          break;
        case "signal:chat":
          if($("#chattr").is(":hidden")){
            _this.unseenCount+=1;
            $("#chatButton").attr("data-unseen-count", _this.unseenCount);
            $("#chatButton").removeClass("no-after");
          } 
          break;
      }
    });
  },
  layout : OT.initLayoutContainer( document.getElementById( "streams_container"), {
      fixedRatio: true,
      animate: true,
      bigClass: "OT_big",
      bigPercentage: 0.85,
      bigFixedRatio: false,
      easing: "swing"
    }).layout,
  removeStream : function(cid){
    $(".stream"+cid).remove();
  },
  userStreamTemplate : Handlebars.compile( $("#userStreamTemplate").html() ),
  triggerActivity : function(activity, action){
    console.log("starting activity");
    switch(activity){
      case "record":
        var data = {action: action, roomId: this.roomId}; // room Id needed for room servation credentials on server
        if(this.archiveId){
          data.archiveId = this.archiveId;
        }
        var self = this;
        $.post("/archive/"+this.session.sessionId, data, function(response){
          console.log("trying to start archive");
          console.log(response);
          if(response.id){
            self.archiveId = response.id;
            if(action == "start")
              self.archiving = true;
            else
              self.archiving = false;
            var signalData = {name: self.name, archiveId: response.id, action: action};
            self.sendSignal("archive",signalData);
          }
        });
        break;
    }
  },
  sendSignal: function( type, data, to ){
    var signalData = {type: type, data: JSON.stringify(data)};
    if(to){
      signalData.to = to;
    }
    this.session.signal( signalData, this.errorSignal );
  },
  errorSignal: function(error){
    if(error){
      console.log("signal error: " + error.reason);
    }
  },
  applyAllFilters: function(){
    console.log("FILTER DATA");
    for(cid in this.filterData){
      this.applyClassFilter(this.filterData[cid], ".stream"+cid);
    }
  },
  applyClassFilter: function(prop, selector){
    if(prop){
      $(selector).removeClass( "Blur Sepia Grayscale Invert" );
      $(selector).addClass( prop );
      console.log("applyclassfilter..."+prop);
    }
  }

}
