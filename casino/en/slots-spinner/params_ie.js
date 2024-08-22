function parseUrl(){var request={};var pairs=location.search.substring(location.search.indexOf('?')+ 1).split('&');for(var i=0;i<pairs.length;i++){if(!pairs[i])
continue;var pair=pairs[i].split('=');request[decodeURIComponent(pair[0])]=decodeURIComponent(pair[1]);}
return request;}
var param=parseUrl();var filter=['model','brand','isp','browser','city'];for(var i=0;i<filter.length;i++){var p=param[filter[i]];switch(filter[i]){case"brand":if(!p||p=="Generic"||p=="Opera"||p=="Unknown"||p=="Mozilla"||p=="Android"||p=="Desktop"){param["brand"]="Google";}
break;case"city":if(!p||p=="Unknown"||p==undefined||p==""||p.search('eneric')>=0)
param["city"]="your city";break;case"model":if(!p||p=="Unknown"||p=="generic"||p==undefined||p==""||p.search('eneric')>=0||p=="generic web browser Desktop"||p.search('eneric')>=0)
param["model"]="cellphone";break;case"browser":if(!p||p=="Unknown"||p==undefined||p==""||p.search('eneric')>=0)
param["browser"]="Google";break;}}