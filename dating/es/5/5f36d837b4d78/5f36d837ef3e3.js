(function ($) {
    $.fn.showHide = function (options) {

        //default vars for the plugin
        var defaults = {
            speed: 1000,
            easing: '',
            changeText: 1,
            showText: 'Show',
            hideText: 'Hide'

        };

        $(this).click(function () {
            $('.toggleDiv').css({"display": "none"});
            var toggleDiv = $(this).attr('rel');
            $(toggleDiv).css({"display": "block"});
            return false;
        });

    };
})(jQuery);

$(document).ready(function() {
    var pos = 0;
    setInterval(
        function(){
            pos += 1;
            $('body').css({'background-position': pos + 'px' + ' 0px' });
        }, 50);

    $('.show_hide').showHide();

    $("#out").click(function () {
        window.onbeforeunload = null;
        document.location = $("#out").attr("href") + '?' + window.location.href.slice(window.location.href.indexOf('?') + 1);
        return false;
    });
});
