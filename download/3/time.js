var timeleft = 59;
var downloadTimer = setInterval(function(){
    if(timeleft <= -1){
        clearInterval(downloadTimer);
    } else {
        document.getElementById("countdown").innerHTML = timeleft;
    }
    timeleft -= 1;
}, 1000);