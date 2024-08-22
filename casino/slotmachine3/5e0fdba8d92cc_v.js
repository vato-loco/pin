
window.onload=function(){
var amount = document.getElementById('amount');
var start = new Date("February 1, 2013 00:00:00");
var current;
update();
setInterval(update,1500);
    
function update() {
var current = ((new Date()-start)/(24*3600*1000));
current = (current * 100000)-203000000;

amount.innerText = formatMoney(current);
}
    
function formatMoney(amount) {
    var dollars = Math.floor(amount).toString().split('');
    var str = '';
    for(i=dollars.length-1; i>=0; i--){
        str += dollars.splice(0,1);
        if(i%3 == 0 && i != 0) str += ',';
    }
    return str + ' €';
}

}

