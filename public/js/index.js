$("#roomName").focus();
$("form").submit(false);

function goToRoom(){
  console.log("goToRoom");  
  var roomName = $("#roomName").val().trim();
  console.log(roomName);  
  if(roomName.length <= 0 ) return;
  $("#roomContainer").fadeOut('slow');
  window.location = "/" + roomName;
}

$('#submitButton').click( goToRoom );

$('#roomName').keypress(function(e){
  if (e.keyCode === 13) goToRoom();
});

verticalCenter = function(){
  var mtop = (window.innerHeight - $("#insideContainer").outerHeight())/2;
  $("#insideContainer").css({"margin-top": mtop+"px"});
}

window.onresize = verticalCenter;

// start execution
verticalCenter();
$.smartbanner(); // don't know why, cannot put this in documentready
