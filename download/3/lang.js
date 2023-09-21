var language = window.navigator ? (window.navigator.language || window.navigator.systemLanguage || window.navigator.userLanguage) : "ru";
language = language.substr(0, 2).toLowerCase();

window.onload = lang();
function lang() {
    var title, desc, seconds, button, footer;
    switch (language) {
        case 'ru':
            title = 'Ваша загрузка готова';
            desc = 'Подтвердите свой номер мобильного телефона в течение ';
            seconds = ' секунд';
            button = 'Подтвердить сейчас';
            footer = 'Загрузчик контента';
            break;
        case 'ro':
            title = 'Descărcarea dvs. este gata';
            desc = 'Confirmați numărul dvs. de mobil în ';
            seconds = ' de secunde';
            button = 'Confirmați acum';
            footer = 'Descărcător de conținut';
            break;
        case 'ar':
            title = 'تحميلك جاهز';
            desc = ' قم بتأكيد رقم هاتفك المحمول في غضون ';
            seconds = ' ثانية ';
            button = 'أكد الآن';
            footer = 'برنامج تنزيل المحتوى';
            break;
        default:
            title = 'Your Download Is Ready';
            desc = 'Confirm your mobile number within ';
            seconds = ' seconds';
            button = 'Confirm Now';
            footer = 'Content Downloader';
            break;
    }
document.getElementById('title').innerHTML = title;
document.getElementById('desc').innerHTML = desc;
document.getElementById('seconds').innerHTML = seconds;
document.getElementById('button').innerHTML = button;
document.getElementById('footer').innerHTML = footer;
}