var fileContent,locationsData;

/**
 * Validate form fields and call server to interpolate given settings
 */
function interpolate() {
    if (!fileContent) {
        warnUser("Choose an Input File.")
    } else if (!locationsData) {
        warnUser("Choose an Locations File.")
    } else if (!($("#kInput").val() && $("#kInput").val()>0)){
        warnUser("Please specify a K value.")    
    } else if (!($("#pInput").val() && $("#pInput").val()>0)){
        warnUser("Please specify a p value.")    
    } else if (!$("#outputFileNameInterpolateData").val()){
        warnUser("Choose an Output Filename.")    
    } else if (!($('#dataInterpolateForm input[type=radio]:checked') && $('#dataInterpolateForm input[type=radio]:checked').length >= 1)){
        warnUser("Choose a time domain.")    
    } else {
        // Settings are valid, so interpolate.
        warnUser("")
        var ajaxSettings = {
                "async": true,
                "url": "interpolate",
                "method": "POST",
                "data": {
                    "dataset": fileContent,
                    "locations": locationsData,
                    "p": $("#pInput").val(),
                    "k": $("#kInput").val(),
                    "t": $('#dataInterpolateForm input[type=radio]:checked')[0].value,
                    "n": $("#outputFileNameInterpolateData").val()
                }
            }
        $.ajax(ajaxSettings)
        .done(function (response) {
            console.log ("done", response)
        })
        .fail(function (response) {
            console.log ("failed", response)
        });
    }
}

function warnUser(warning) {
    $("#warn").html ("<p>"+warning+"</p>");
}

// On file load
function onFileInputDataLoad(e) {
    fileContent = e.target.result;
}

// On file load
function onFileInputLocationsLoad(e) {
    locationsData = e.target.result;
}

// http://www.htmlgoodies.com/beyond/javascript/read-text-files-using-the-javascript-filereader.html#fbid=QpKAwIInRNF
function onFileInputDataInputChange(evt) {
    
    console.log ("onFileInputDataInputChange")
    var f = evt.target.files[0]; 
    
    if (f) {
        var r = new FileReader();
        r.onload = onFileInputDataLoad;
        r.readAsText(f);
    } else { 
        alert("Failed to load file");
    }
}

function onFileInputLocationsChange(evt) {
    
    console.log ("onFileInputLocationsChange")
    var f = evt.target.files[0]; 
    
    if (f) {
        var r = new FileReader();
        r.onload = onFileInputLocationsLoad;
        r.readAsText(f);
    } else { 
        alert("Failed to load file");
    }
}

$(function() {
  // Handler for .ready() called.
        
    document.getElementById('fileinputDataInput').addEventListener('change', onFileInputDataInputChange, false);
    document.getElementById('fileinputLocations').addEventListener('change', onFileInputLocationsChange, false);
    $('#interpolate').click(interpolate);    
})