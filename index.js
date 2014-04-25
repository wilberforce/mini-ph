var i2c = require('i2c');

/* To Do
 * temperature adjustment - calibration, and read of pH
 * Event emitter?
 * Stream interface?
 */
 
 // Based on code - https://github.com/SparkysWidgets/MinipHBFW

/*
This is a simple example showing how to interface our mini I2C pH interface.
The usage for this design is very simple, as it uses the MCP3221 I2C ADC. Although actual
pH calculation is done offboard the analogue section is very well laid out giving great results
at varying input voltages (see vRef for adjusting this from say 5v to 3.3v).
MinipH can operate from 2.7 to 5.5V to accommodate varying levels of system. Power VCC with 3.3v for a raspi!

ADC samples at ~28.8KSPS @12bit (4096 steps) and has 8 I2C address of from A0 to A7 (Default A5)
simply assemble the 2 BYTE registers from the standard I2C read for the raw reading.
conversion to pH shown in code.

Note: MinipH has an optional Vref(4.096V) that can be bypassed as well!

Sparky's Widgets 2012
http://www.sparkyswidgets.com/Projects/MiniPh.aspx

 */

/*
var MiniPh.params = {
pHCalHigh : 2048, //assume ideal probe and amp conditions 1/2 of 4096
pHCalLow : 1286, //using ideal probe slope we end up this many 12bit units away on the 4 scale
pHStep : 59.16, //ideal probe slope
pHCalLowSolution : 4,
pHCalHighSolution : 7,
vRef : 4.096, //Our vRef into the ADC wont be exact , Since you can run VCC lower than Vref its best to measure and adjust here
opampGain : 5.25, //what is our Op-Amps gain (stage 1)
filter_n: 15.0
}

Actual values 5 jan 14
"pHCalHigh": 2017,
"pHCalLow": 1250,
"pHStep": 51.08225108225108,
"pHCalLowSolution": 4,
"pHCalHighSolution": 6.86,

 */

var MiniPh = function (device, address) {
	this.device = device;
	this.address = address;
	this.wire = new i2c(address, {
			device : device
		});
	this.calcpHSlope();
}

MiniPh.params = require('./ph-config.json');

MiniPh.prototype.saveConfig = function () {
	require('fs').writeFileSync('./ph-config.json', JSON.stringify(MiniPh.params, null, 4));
}
// MCP3221 address A5 in Dec 77 A0 = 72 A7 = 79)
// A0 = x48, A1 = x49, A2 = x4A, A3 = x4B,
// A4 = x4C, A5 = x4D, A6 = x4E, A7 = x4F


//Lets read our raw reading while in pH7 calibration fluid and store it
//We will store in raw int formats as this math works the same on pH step calcs
MiniPh.prototype.calibratepHHigh = function (calnum) {
	MiniPh.params.pHCalHigh = calnum;
	this.calcpHSlope();
}

//Lets read our raw reading while in pH4 calibration fluid and store it
//We will store in raw int formats as this math works the same on pH step calcs
//Temperature compensation can be added by providing the temp offset per degree
//IIRC .009 per degree off 25c (temperature-25*.009 added pH@4calc)
MiniPh.prototype.calibratepHLow = function (calnum) {
	MiniPh.params.pHCalLow = calnum;
	this.calcpHSlope();
}

//This is really the heart of the calibration process, we want to capture the
//probes "age" and compare it to the Ideal Probe, the easiest way to capture two readings,
//at known point(4 and 7 for example) and calculate the slope.
//If your slope is drifting too much from Ideal(59.16) its time to clean or replace!
MiniPh.prototype.calcpHSlope = function () {
	//RefVoltage * our deltaRawpH / 12bit steps *mV in V / OP-Amp gain /pH step difference 7-4
	MiniPh.params.pHStep = ((((MiniPh.params.vRef * (MiniPh.params.pHCalHigh - MiniPh.params.pHCalLow)) / 4096.0) * 1000) / MiniPh.params.opampGain) / (MiniPh.params.pHCalHighSolution - MiniPh.params.pHCalLowSolution);
}

//Now that we know our probe "age" we can calculate the proper pH Its really a matter of applying the math
//We will find our millivolts based on ADV vref and reading, then we use the 7 calibration
//to find out how many steps that is away from 7, then apply our calibrated slope to calculate real pH
MiniPh.prototype.calcpH = function (raw) {
	var millivolts = ((raw / 4096.0) * MiniPh.params.vRef) * 1000;
	var delta = ((((MiniPh.params.vRef * MiniPh.params.pHCalHigh) / 4096.0) * 1000) - millivolts) / MiniPh.params.opampGain;
	var pH = MiniPh.params.pHCalHighSolution - (delta / MiniPh.params.pHStep);
	pH = Math.round(pH * MiniPh.params.scale) / MiniPh.params.scale;
	//pH = pH.toPrecision(MiniPh.params.scale.toString().length);
	return pH;
}

// reset filter when changing solution
MiniPh.prototype.resetFilter = function () {
	this.filter = undefined;
}

MiniPh.prototype.readPh = function (callback) {
	m = this;
	this.wire.readBytes(0x00, 2, function (err, res) {
		m.raw = res[0] * 256 + res[1];
		if (m.filter === undefined) {
			m.filter = m.raw
		} else {
			m.last = m.filter;
			m.filter = Math.round((m.filter * (MiniPh.params.filter_n - 1) + m.raw) / MiniPh.params.filter_n);
			var delta = Math.abs(m.raw - m.last);
			if (delta > 600) { // Massive jump so assume new calibration solution, reset filter
				m.filter = m.raw;
			}
		}
		m.ph = m.calcpH(m.filter);
		callback(err, m);
	});
}

module.exports = MiniPh;
