var fileContent;

// On file load
function onFileLoad(e) {
    points = [];
    fileContent = e.target.result;
}

function interpolate() {
    if (fileContent) {
        warnUser("")
        var ajaxSettings = {
                "async": true,
                "url": "interpolate",
                "method": "POST",
                "data": {
                    "payload": fileContent,
                    "p": 3,
                    "k": 6
                }
            }
        $.ajax(ajaxSettings)
        .done(function (response) {
            console.log ("done", response)
        })
        .fail(function (response) {
            console.log ("failed", response)
        });
    } else {
        warnUser("Choose a File.")
    }
}

function warnUser(warning) {
    $("#warn").html ("<p>"+warning+"</p>");
}

// http://www.htmlgoodies.com/beyond/javascript/read-text-files-using-the-javascript-filereader.html#fbid=QpKAwIInRNF
function readSingleFile(evt) {
    
    console.log ("readSingleFile")
    var f = evt.target.files[0]; 
    
    if (f) {
        var r = new FileReader();
        r.onload = onFileLoad;
        r.readAsText(f);
    } else { 
        alert("Failed to load file");
    }
}
$(function() {
  // Handler for .ready() called.
        
    document.getElementById('fileinput').addEventListener('change', readSingleFile, false);
    $('#interpolate').click(interpolate);    
})