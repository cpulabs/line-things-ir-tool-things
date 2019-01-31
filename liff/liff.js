
//UUID正しいの書き込み済み


// User service UUID: Change this to your generated service UUID
const USER_SERVICE_UUID           = 'd6d88913-6e55-4e8d-87f4-af235868b377'; // CMD
const CMD_CHARACTERISTIC_UUID     = 'e98498a0-e624-4150-9c19-8ae5b6e7b044';
const MATRIX_CHARACTERISTIC_UUID  = '2fe4e8a1-af17-4faa-b587-7d639a79b9c1';

// PSDI Service UUID: Fixed value for Developer Trial
const PSDI_SERVICE_UUID         = 'e625601e-9e55-4597-a598-76018a0d293d'; // Device ID
const PSDI_CHARACTERISTIC_UUID  = '26e2b12b-85f0-4f3f-9fdd-91d114270e6e';



let g_rawcode = [];
let g_ir_freq;
let g_ir_format;
let g_rawcode_length;

let g_ir_margin = 2;    //Convert to IRKit value from ESP32



// -------------- //
// On window load //
// -------------- //

window.onload = () => {
    initializeApp();

    sendLine();
};

// ------------ //
// UI functions //
// ------------ //

function uiDebugMessage(message){
  var debug_text = document.getElementById('debug');
  debug_text.innerHTML = message;
}

function uiDebug1Message(message){
  var debug_text = document.getElementById('debug1');
  debug_text.innerHTML = message;
}

function uiDebug2Message(message){
  var debug_text = document.getElementById('debug2');
  debug_text.innerHTML = message;
}


function uiProgressBar(max, value){
  var progressBar = document.getElementById('state_progress');
  progressBar.max = max;
  progressBar.value = value;
}


function uiToggleDeviceConnected(connected) {
    const elStatus = document.getElementById("status");
    const elControls = document.getElementById("controls");

    elStatus.classList.remove("error");

    if (connected) {
        // Hide loading animation
        uiToggleLoadingAnimation(false);
        // Show status connected
        elStatus.classList.remove("inactive");
        elStatus.classList.add("success");
        elStatus.innerText = "Device connected";
        // Show controls
        elControls.classList.remove("hidden");
    } else {
        // Show loading animation
        uiToggleLoadingAnimation(true);
        // Show status disconnected
        elStatus.classList.remove("success");
        elStatus.classList.add("inactive");
        elStatus.innerText = "Device disconnected";
        // Hide controls
        elControls.classList.add("hidden");
    }
}

function uiToggleLoadingAnimation(isLoading) {
    const elLoading = document.getElementById("loading-animation");

    if (isLoading) {
        // Show loading animation
        elLoading.classList.remove("hidden");
    } else {
        // Hide loading animation
        elLoading.classList.add("hidden");
    }
}

function uiStatusError(message, showLoadingAnimation) {
    uiToggleLoadingAnimation(showLoadingAnimation);

    const elStatus = document.getElementById("status");
    const elControls = document.getElementById("controls");

    // Show status error
    elStatus.classList.remove("success");
    elStatus.classList.remove("inactive");
    elStatus.classList.add("error");
    elStatus.innerText = message;

    // Hide controls
    elControls.classList.add("hidden");
}

function makeErrorMsg(errorObj) {
    return "Error\n" + errorObj.code + "\n" + errorObj.message;
}

// -------------- //
// LIFF functions //
// -------------- //

function initializeApp() {
    liff.init(() => initializeLiff(), error => uiStatusError(makeErrorMsg(error), false));

    /*
    document.getElementById('id_sendline').addEventListener('click', function () {
        liff.sendMessages([{
            type: 'text',
            text: "test - line message "
        }, {
            type: 'sticker',
            packageId: '2',
            stickerId: '144'
        }]).then(function () {
            window.alert("Message sent");
        }).catch(function (error) {
            window.alert("Error sending message: " + error);
        });
    });
    */
}


function initializeLiff() {
    liff.initPlugins(['bluetooth']).then(() => {
        liffCheckAvailablityAndDo(() => liffRequestDevice());
    }).catch(error => {
        uiDebugMessage("initializeLiff");
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffCheckAvailablityAndDo(callbackIfAvailable) {
    // Check Bluetooth availability
    liff.bluetooth.getAvailability().then(isAvailable => {
        if (isAvailable) {
            uiToggleDeviceConnected(false);
            callbackIfAvailable();
        } else {
            uiDebugMessage("liffCheckAvailablityAndDo - else");
            uiStatusError("Bluetooth not available", true);
            setTimeout(() => liffCheckAvailablityAndDo(callbackIfAvailable), 10000);
        }
    }).catch(error => {
        uiDebugMessage("liffCheckAvailablityAndDo - error");
        uiStatusError(makeErrorMsg(error), false);
    });;
}

function liffRequestDevice() {
    liff.bluetooth.requestDevice().then(device => {
        liffConnectToDevice(device);
    }).catch(error => {
        uiDebugMessage("liffRequestDevice");
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffConnectToDevice(device) {
    device.gatt.connect().then(() => {
        document.getElementById("device-name").innerText = device.name;
        document.getElementById("device-id").innerText = device.id;

        // Show status connected
        uiToggleDeviceConnected(true);

        // Get service
        device.gatt.getPrimaryService(USER_SERVICE_UUID).then(service => {
            liffGetUserService(service);
        }).catch(error => {
            uiDebugMessage("liffConnectToDevice - USER_SERVICE_UUID");
            uiStatusError(makeErrorMsg(error), false);
        });
        device.gatt.getPrimaryService(PSDI_SERVICE_UUID).then(service => {
            liffGetPSDIService(service);
        }).catch(error => {
            uiDebugMessage("liffConnectToDevice - PSDI_SERVICE_UUID");
            uiStatusError(makeErrorMsg(error), false);
        });


        // Device disconnect callback
        const disconnectCallback = () => {
            // Show status disconnected
            uiToggleDeviceConnected(false);

            // Remove disconnect callback
            device.removeEventListener('gattserverdisconnected', disconnectCallback);


            // Try to reconnect
            initializeLiff();
        };

        device.addEventListener('gattserverdisconnected', disconnectCallback);
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffGetUserService(service) {
    // Button pressed state
    service.getCharacteristic(MATRIX_CHARACTERISTIC_UUID).then(characteristic => {
        liffGetMatrixDataCharacteristic(characteristic);
    }).catch(error => {
        uiDebugMessage("liffGetUserService");
        uiStatusError(makeErrorMsg(error), false);
    });

    // Write CMD
    service.getCharacteristic(CMD_CHARACTERISTIC_UUID).then(characteristic => {
        window.cmdCharacteristic = characteristic;
        //
        //liffWriteCmdToDevice(false);
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffGetPSDIService(service) {
    // Get PSDI value
    service.getCharacteristic(PSDI_CHARACTERISTIC_UUID).then(characteristic => {
        return characteristic.readValue();
    }).then(value => {
        // Byte array to hex string
        const psdi = new Uint8Array(value.buffer)
            .reduce((output, byte) => output + ("0" + byte.toString(16)).slice(-2), "");
        document.getElementById("device-psdi").innerText = psdi;
    }).catch(error => {
        uiDebugMessage("liffGetPSDIService");
        uiStatusError(makeErrorMsg(error), false);
    });
}



function liffGetMatrixDataCharacteristic(characteristic) {
    characteristic.startNotifications().then(() => {
        characteristic.addEventListener('characteristicvaluechanged', e => {
            //const val = (new Uint8Array(e.target.value.buffer))[0];
            const data = (new Uint8Array(e.target.value.buffer));     //16Byte


            if(data[0] == 0){
              var index = data[1];
              var length_index = (data[2] << 8) + data[3];
              var ir_freq = data[4];
              var ir_format = data[5];
              var rawcode_length = (data[6] << 8) + data[7];
              var code0 = (data[8] << 24) + (data[9] << 16) + (data[10] << 8) + data[11];
              var code1 = (data[12] << 24) + (data[13] << 16) + (data[14] << 8) + data[15];

              g_rawcode[index*2] = code0 * g_ir_margin;
              //一番最後のデータを取得しないようにするため
              if((index == (length_index-1) && rawcode_length % 2 == 1) != 1){
                g_rawcode[index*2 + 1] = code1 * g_ir_margin;
              }

              uiDebug1Message(index);
              uiDebug2Message(length_index);

              uiProgressBar(length_index-1, index);

              if(index == (length_index-1)){
                  g_ir_freq = ir_freq;
                  g_ir_format = ir_format;
                  g_rawcode_length = rawcode_length;

                  document.getElementById("rawcode_length").innerText = rawcode_length;
                  var fotmat_txt = "";
                  if(ir_format == 0){
                    fotmat_txt = "UNKNOWN";
                  }else if(ir_format == 1){
                    fotmat_txt = "NEC";
                  }else if(ir_format == 2){
                    fotmat_txt = "SONY";
                  }else if(ir_format == 3){
                    fotmat_txt = "PANASONIC";
                  }else if(ir_format == 4){
                    fotmat_txt = "JVC";
                  }else if(ir_format == 5){
                    fotmat_txt = "RC5";
                  }else if(ir_format == 6){
                    fotmat_txt = "RC6";
                  }else if(ir_format == 7){
                    fotmat_txt = "SAMSUNG";
                  }else if(ir_format == 8){
                    fotmat_txt = "WHYNTER";
                  }else if(ir_format == 9){
                    fotmat_txt = "AIWA RC T501";
                  }else if(ir_format == 10){
                    fotmat_txt = "LG";
                  }else if(ir_format == 11){
                    fotmat_txt = "SANYO";
                  }else if(ir_format == 12){
                    fotmat_txt = "MITSUBISHI";
                  }else if(ir_format == 13){
                    fotmat_txt = "DISH";
                  }else if(ir_format == 14){
                    fotmat_txt = "SHARP";
                  }else if(ir_format == 15){
                    fotmat_txt = "DENON";
                  }else if(ir_format == 16){
                    fotmat_txt = "PROTON";
                  }else if(ir_format == 17){
                    fotmat_txt = "LEGO_PF";
                  }else{
                    fotmat_txt = "UNKNOWN";
                  }
                  document.getElementById("code_format").innerText = fotmat_txt;

                  var freq_txt = ""; //0:UNKNOW, 1:30kHz, 2:33kHz, 3:36 kHz, 4:36,7kHz, 5:38kHz, 6:40kHz, 7:56 kHz
                  if(ir_freq == 0){
                    freq_txt = "UNKNOWN";
                  }else if(ir_freq == 1){
                    freq_txt = "30KHz";
                  }else if(ir_freq == 2){
                    freq_txt = "33KHz";
                  }else if(ir_freq == 3){
                    freq_txt = "36KHz";
                  }else if(ir_freq == 4){
                    freq_txt = "36.7KHz";
                  }else if(ir_freq == 5){
                    freq_txt = "38KHz";
                  }else if(ir_freq == 6){
                    freq_txt = "40KHz";
                  }else if(ir_freq == 7){
                    freq_txt = "56KHz";
                  }else{
                    freq_txt = "UNKNOWN";
                  }

                  document.getElementById("freq").innerText = freq_txt;

                  var str_rawcode = "";
                  for(var i = 0; i < rawcode_length; i = i + 1){
                    str_rawcode = str_rawcode + g_rawcode[i];
                    if(i < rawcode_length - 1){
                      str_rawcode = str_rawcode + ",";
                    }
                  }
                  document.getElementById("rawcode").innerText = str_rawcode;
                  //document.getElementById("rawcode").value = str_rawcode;
              }
            }else if(data[0] == 1){
                //receive comprex Data
                var r_comprex = (data[12] << 24) + (data[13] << 16) + (data[14] << 8) + data[15];
                document.getElementById("code_comprex").innerText = r_comprex.toString(16);

            }
        });
    }).catch(error => {
        uiDebugMessage("liffGetMatrixDataCharacteristic");
        uiStatusError(makeErrorMsg(error), false);
    });
}



function transmit_ir() {
  uiProgressBar(100, 0);
  ble_transmit_cmd(0)
}

function receive_ir() {
  uiProgressBar(100, 0);
  ble_transmit_cmd(1)
}


function sendLine(){

}



//CMD0:Transmit BLE Signel, CMD1:Reveive
function ble_transmit_cmd(cmd) {
  if(cmd == 0){
    for(var i = 0; i < g_rawcode_length/2; i = i + 1){
      uiProgressBar(g_rawcode_length/2, i+1);

      var tx_data = [];

      /*
      for(var j = 0; j < 2; j = j + 1){
        tx_data[j] = 0xff & (i >> (8*(1-j)));
      }
      */
      //CMD
      tx_data[0] = 0;
      //index
      tx_data[1] = i & 0xff;


      for(var j = 0; j < 2; j = j + 1){
        tx_data[2+j] = 0xff & ((g_rawcode_length/2) >> (8*(1-j)));
      }

      //freq(0:38k, 1;40k)
      tx_data[4] = 0;
      //Format(0:unknown, 1:NEC, 2:SONY...)
      tx_data[5] = 1;

      //Number of Frame
      for(var j = 0; j < 2; j = j + 1){
        tx_data[6+j] = 0xff & (g_rawcode_length >> (8*(1-j)));
      }

      //Data0
      for(var j = 0; j < 4; j = j + 1){
        tx_data[8+j] = 0xff & ((g_rawcode[i*2] / g_ir_margin) >> (8*(3-j)));
      }

      //Data1
      for(var j = 0; j < 4; j = j + 1){
        tx_data[12+j] = 0xff & ((g_rawcode[i*2 + 1] / g_ir_margin) >> (8*(3-j)));
      }

      //Transmit
      window.cmdCharacteristic.writeValue(new Uint8Array(tx_data)).catch(error => {
        uiDebugMessage("liffWriteLoadMatrix");
        uiStatusError(makeErrorMsg(error), false);
      });
    }
  }else{
    window.cmdCharacteristic.writeValue(new Uint8Array([1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])).catch(error => {
      uiDebugMessage("liffWriteLoadMatrix - Req");
      uiStatusError(makeErrorMsg(error), false);
    });
  }
}
