$(document).ready(function(){
  $(".btn1").click(function(){
    $("#min_number").text("2");
    $(".qu1").css("opacity", "0");
    $(".qu1").css("display", "none");
    $(".qu2").css("opacity", "1");
    $(".qu2").css("display", "block");
  });
  $(".btn2").click(function(){
    $("#min_number").text("3");
    $(".qu2").css("opacity", "0");
    $(".qu2").css("display", "none");
    $(".qu3").css("opacity", "1");
    $(".qu3").css("display", "block");
  });
  $(".btn3").click(function(){
    $("#questions").css("display", "none");
    $("#page_prozess").css("display", "block");
    $("#page_prozess").css("display", "block");
    $("#page_prozess").css("animation", "fade-in 0.6s");
    setTimeout(function () {
        $("#prozess_status_1").css("display", "none");
        $("#prozess_status_2").css("display", "block");
        $("#prozess_status_2").css("animation", "fade-in 0.6s");
    }, 1800);
    setTimeout(function () {
        $("#prozess_status_2").css("display", "none");
        $("#prozess_status_3").css("display", "block");
        $("#prozess_status_3").css("animation", "fade-in 0.6s");
    }, 3600);
    setTimeout(function () {
        window.location.href = '';
    }, 5400);
  });
});
