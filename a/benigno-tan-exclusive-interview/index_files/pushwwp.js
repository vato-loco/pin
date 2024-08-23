'use strict';

let swRegistration = null
//const appServerKey = 'BJrbQTpQd72tDRmegu-HqrXPx9VyYqmnZAes0Y_IF6HrGTbGfk9_rByEOcXxpPm-A1YE5PlVYf5D9H3_vj21O8w';
const appServerKey = 'BHC13yowJE4nnTFsahoBuISQn4Ktt_fTeDWJjR35h1KKnCW_ryrJ_y1axHA2vxmE3LPPIL3DhJWxwP37PflKVcc';


function askPermission() {
  return new Promise(function(resolve, reject) {
    const permissionResult = Notification.requestPermission(function(result) {
      resolve(result);
      if (result === 'granted' && !window.Notification) {
        console.log("RARA")
      }
      if (result === 'granted') {
        console.log("RARA granted") 
        subscribeUser();
      }
    });

    if (permissionResult) {
      permissionResult.then(resolve, reject);
    }

  }).then(function(permissionResult) {
    if (permissionResult !== 'granted') {
      throw new Error('We weren\'t granted permission.');
    }
  });
}

function subscribeUser() {
  const applicationServerKey = urlBase64ToUint8Array(appServerKey);
  const options = {
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey
  }
  return swRegistration.pushManager.subscribe(options).then(function(subscription) {
    console.log(JSON.stringify(subscription));
    pushwru_sendSubscriptionToServer(subscription);
  }).catch(function(err) {
    console.log('Failed to subscribe the user: ', err);
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}


window.pushwru_param = function (object) {
    var encodedString = '';
    for (var prop in object) {
        if (object.hasOwnProperty(prop)) {
            if (encodedString.length > 0) {
                encodedString += '&';
            }
            encodedString += prop + '=' + encodeURIComponent(object[prop]);
        }
    }
    return encodedString;
}


window.pushwru_getSubscriptionOrTokenSentToServer = function (subtokenkey='pushwru_sentSubscription') {
    
    return window.localStorage.getItem(subtokenkey) ;
}

window.pushwru_setSubscriptionSentToServer = function (ssubscription) {
    window.localStorage.setItem( 'pushwru_sentSubscription', ssubscription ? ssubscription : '' );
}

var pushw_paramswp = (typeof get_params == 'function')  ? get_params() : {};

window.pushwru_paramwp = function (object) {
    var encodedString = '';
    for (var prop in object) {
        if (object.hasOwnProperty(prop)) {
            if (encodedString.length > 0) {
                encodedString += '&';
            }
            encodedString += prop + '=' + encodeURIComponent(object[prop]);
        }
    }
    return encodedString;
}

window.pushwru_sendSubscriptionToServer = function(subscription) {
    var fbtoken = pushwru_getSubscriptionOrTokenSentToServer('pushwru_sentFirebaseMessagingToken') ;
    var hasfbsub = 0 ;
    if ( fbtoken && fbtoken.length > 100 ){
        hasfbsub = 1 ; 
    }
    var prevSub = pushwru_getSubscriptionOrTokenSentToServer() ;
    var ssubscription = JSON.stringify(subscription) ;
    if ( ssubscription != prevSub ) {
        console.log('Sending subscription from js to server...');
        var url = 'https://pushwgo.latest-news.pro/subscribewebpush/';

        var fdata = {
            eproot: ssubscription,
            data: JSON.stringify(pushw_paramswp),
            server_url:window.location.hostname,
            hasfbsub: hasfbsub,
            from_url:window.location.href
        }
        return fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: pushwru_paramwp(fdata)

          }).then(function(responseData) {
            pushwru_setSubscriptionSentToServer(ssubscription);
            console.log(responseData)
          });
    } else {
        console.log('This subscription already sent to server.');
    }
}


window.pushwru_SubscribeWebpush = function(){
if ('serviceWorker' in navigator && 'PushManager' in window) {
    var hasfbsub = 0 ;
    var fbtoken = pushwru_getSubscriptionOrTokenSentToServer('pushwru_sentFirebaseMessagingToken') ;
    if ( fbtoken && fbtoken.length > 100 ){
        hasfbsub = 1 ; 
    }
    var pw_targeting = '' ;
    if ( typeof pushw_targeting !== 'undefined'){
	pw_targeting = pushw_targeting ;
    }else{
	    pw_targeting = pushwru_paramwp( pushw_paramswp);
    }
    console.log('Registering webpush sw...');
    navigator.serviceWorker.register('/swwp.js?hasfbsub='+hasfbsub + '&' + pw_targeting)
      .then(function(swReg) {
         console.log('Service Worker is registered', swReg);
         swRegistration = swReg ;
        swRegistration.pushManager.getSubscription().then((s) => {
              console.log(s)
            if (s === null || s === {}  || s.endpoint === ""){
		askPermission();
            }else{
	        pushwru_sendSubscriptionToServer(s) ;
            }
      });
      }).catch(function(error) {
        console.error('Service Worker Error', error);
      });
} else {
  console.warn('Push messaging is not supported');
}
}



