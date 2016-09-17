// -- Grit: grammar support module ------------------------------------------------

/*	The MIT License (MIT)
 *
 *	Copyright (c) 2016 Peter Cashin
 *
 *	Permission is hereby granted, free of charge, to any person obtaining a copy
 *	of this software and associated documentation files (the "Software"), to deal
 *	in the Software without restriction, including without limitation the rights
 *	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *	copies of the Software, and to permit persons to whom the Software is
 *	furnished to do so, subject to the following conditions:
 *
 *	The above copyright notice and this permission notice shall be included in all
 *	copies or substantial portions of the Software.
 *
 *	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *	SOFTWARE.
 */

;(function() { // name-space wrapper -- expose Grit at the bottom of this file...

	/*
	 Grit() usage:

	 Using JavaScript ES5 ..............................................................

	 var myGrit = new Grit("rule0..", "rule1..", ...); // a new Grit grammar
	 var myGrit = Grit("rule0..", "rule1", ...); // same thing

	 myGrit.define("rulei..", "rulej", ...); // optional, define (more) rules...

	 myGrit.parse("input.."); // first use will auto compile

	 myGrit.parse("input..", true); // turn trace reporting on for this parse...


	 Using JavaScript ES6 ... tag template rules ........................................

	 var myGrit = Grit` ... rule(s) ... `;

	 myGrit.define`...rules...`; // optional, define (more) rule(s)

	 myGrit.parse("input.."); // first use will auto compile

	 myGrit.parse("input..", true); // turn trace reporting on for this parse...


	 Semantic Actions ....................................................................

	 // rule := or :~ .....  :: foo

	 or $ to trace the semantic action:
	 // rule := or :~ .....  :: $ foo

	 myGrit.foo = function(...) { ... }; // define a "foo" semantic action

	 Note:

	 * Semantic action function names must not conflict with the reserved names:
	 define, parse, _privateNames...

	 * Context for semantic actions is an instance of a Parser object:
	 input = the input string being parsed
	 pos = current parser position
	 grit = the grammar rules

	 */

	var FAIL = null; // return value for failure

	var Grit = function() { // call may be ES5 or ES6, but Grit itself does not require ES6
		var grit = this; // may be called as: Grit() or new Grit()
		if (!(this instanceof Grit)) { grit = new Grit(); }
		grit.define.apply(grit, arguments); // i.e. ...arguments, but avoids using ES6 in Grit
		return grit;
	}

// -- grip -- Grit prototype ------------------------------------------------

	Grit.prototype = {};

	var grip = Grit.prototype;

	var RULE = /^\s*(\w+)\s*([:][=~:])\s*([^\n\r]*)/;
// var _RULE = /^\s*(!:\w+\s*[:][=~:])[^\n\r]*/;

	var PEG_RULE = ':=', REGEXP_RULE = ':~', FUN_RULE = '::';

	grip.define = function() { // rule definitions, either a tag template or standard arguments....
		if (arguments.length === 0) return;
		if (!this._rules) this._init(); // define first rule(s)...
		var template = arguments[0]; // may be either a tag template or standard arguments....
		if (template instanceof Array &&  template.raw) { // ES6 tag template...
			this._templateRules.apply(this, arguments); // i.e. ...arguments, but avoids using ES6 in Grit
		} else { // ES5 Grit(rule, rule, ...);
			var args = []; // to allow multi-line arg values...
			for (var i=0; i<arguments.length; i++) {
				var arg = arguments[i];
				args = args.concat(arg.split('\n'));
			}
			this._createRules(args); // may be none e.g. new Grit();
		}
		this._compiled = false; // compile on next .parse()
	}

	grip._init = function() { // new Grit, first call to define rules...
		this._rules = []; // define source text
		this._rule = {}; // compiled rules
		this._action = {}; // semantic action, type translators
		this._actArgs = {}; // semantic action, type translator arguments...
		this._actionTrace = {}; // action trace flag from grammar rule :: $
		this._actionTraceFlag = false; // any _actionTrace[rule] :: $ triggered
		this._matchAllInput = false; // default returns any length match
		this._lastMatch = null;	// set by parse() to successfully matched input
	}

	grip._templateRules = function() { // vararg arguments...
		var template = arguments[0].raw; // ES6 tag template expected...
		var rules = "";
		var types = {};
		for (var i=0; i<template.length; i+=1) {
			if (i > 0 && arguments[i]) {
				var arg = arguments[i];
				if (typeof arg === 'string') {
					rules += arg;
				} else if (typeof arg === 'function') {
					rules += "<"+i+">";
					types[i] = arg;
				}
			}
			rules += template[i];
		}
		this._createRules(rules.split(/\n/), types);
	}

	grip._createRules = function(rules, types) {
		var errors = []
		for (var i = 0; i < rules.length; i++) {
			var rule = rules[i];
			if (!rule) continue;
			var rx = rule.match(RULE); // read full rule...
			if (rx) {
				var type = rx[2]; // := | :~
				var body = rx[3]; // ... :: ...
				while (i+1 < rules.length) { // ... more lines ...
					var nxtrule = rules[i+1].match(RULE);		//RWW: avoid duplicate use of var rule
					if (nxtrule) break; // start of next rule...
					body += '\n'+rules[i+1];
					i += 1;
				}
				var act = null, pax = null;
				if (type===PEG_RULE) { // .... ' :: ' ... :: ....
					pax = body.match(/^((?:[^:']|:[^:]|'[^']*')*)::\s*([\s\S]*)/);
				} else if (type===REGEXP_RULE) { // ... :: ...
					pax = body.match(/^((?:[^:']|:[^:])*)::\s*([\s\S]*)/);
				}
				if (pax) { // ... :: act...
					body = pax[1];
					act = pax[2];
					var nx = act.match(/<(\d+)>/);
					if (nx) act = types[nx[1]];
				}
				this._rules.push( { name: rx[1], type: type, body: body, act: act } );
			} else {
				errors.push("Bad rule format: "+rule)
				console.error(errors[errors.length-1])
			}
		}
		if (errors.length>0)
			throw new Error(errors.join('\n\t'))
	}


// compile rules ----------------------------------------------------------------------

	grip._compile = function() {	//RWW: added error processing
		var errors = this._compileRules();
		this._compiled = true;
		return errors
	}

	grip._compileRules = function () {
		var errors = []		//RWW: for collecting errors
		for (var i=this._rules.length-1; i>-1; i--) {
			var rule = this._rules[i];
			if (rule.type === REGEXP_RULE) {
				try {
					this._rule[rule.name] = new RegExp("^(?:"+this._makeRegExp(rule)+")", "g");
				} catch(err) {
					//RWW: console.log('*** '+rule.name+" :~ "+err+"\n"+rule);
					report(["Rule ", rule.name, ' has invalid RegExp /', rule.body.trim(),  "/ : ", err])
				}
			} else if (rule.type === PEG_RULE) {
				this._rule[rule.name] = GRIT.parse(rule.body);
			} else if (rule.type === FUN_RULE) { // name :: action
				// RWW: this.pos must be set to consume content in function
				this._rule[rule.name] = function(content, args){this.pos = this.pos + content.length; return [content, args];};
				rule.act = rule.body;
			} else {
				//RWW: console.log("Undefined rule type: ", rule);
				report(["Rule ", rule.name, 'has undefined type ', rule.type])
			}
			if (rule.act) {
				var act = rule.act;		// console.log(typeof act, ' action:', act)
				if (typeof act === 'string') {
					var flag = act.match(/^\s*\$\s*/); // $ trace flag
					if (flag) {
						act = act.slice(flag[0].length);
						this._actionTrace[rule.name] = true;
						this._actionTraceFlag = true;
					}
					try {
						act = this._compileAction(rule, act);
						if (typeof act === 'function') {
							this._action[rule.name] = act;
						} else
						//RWW: console.log('Bad semantic action: function expected... \n\t'+rule.name+' ... :: '+act);
							report(["Rule ", rule.name, " ... :: ", act, '\tBad semantic action: function expected.'])
					}  catch(err) {
						//RWW: console.log('Bad semantic action: '+err+"\n\t"+rule.name+" ... :: "+act);
						//RWW? return;
						report(["Rule ", rule.name, " ... :: ", act, '\tBad semantic action ', err])
					}
				}
			}
		}
		//RWW start
		return errors

		function report(errMessage) {
			var errString = errMessage.join('')
			errors.push(errString)
			console.error(errString)
		}
		//RWW end
	}

// compile semantic action function -----------------------

	grip._compileAction = function (rule, act) {
		var fn;
		var ax = act.match(/^\s*([a-zA-Z]\w*)\s*(.*)$/)
		if (!ax) { // (..) => ... or ( ... ) or // ..anything else..
			var fx = act.match(/^\s*(\([^\)]*\))\s*=>\s*([\s\S]*)/);
			if (fx) {  // ES6: (...) => ...
				var body = fx[2];
				var k = body.lastIndexOf('//');
				if (k>0 && /^\/\/[^\n\r]*\s*$/.test(body.slice(k))) { body = body.slice(0,k); }
				k = body.lastIndexOf(';');
				if (k>0 && /^;\s*$/.test(body.slice(k))) { body = body.slice(0,k); }
				if (/^[^{]/.test(body)) { body = '{ return ('+body+')}'; }
				fn = eval('(function'+fx[1]+body+')');
			} else { // ES5: ( function() {...} ) or junk...
				fn = eval(act);
			}
		} else {
			var fun = ax[1]; // function name...
			if (fun === 'function') { // :: function(...) {... }
				fn = eval('(' + act + ')');
			} else { //  :: fun ....
				fn = this[fun]; // grammar function...
				this._actArgs[rule.name] = ax[2]; // arg string
			}
		}
		return fn;
	}

// compose RegExp rule -------------------------------------

	grip._makeRegExp = function (rule) {
		var that = this;
		var txt = rule.body.trim();
		txt = txt.replace(/%[a-zA-Z]\w*/g, function(name) {
			var rex = that._rule[name.slice(1)]; // defined rule?
			if (rex instanceof RegExp) { // leaf rule
				return rex.toString().slice(2,-2); // /^.../g
			} else {
				console.log("Undefined rule: "+name+" in: "+txt);
			}
			return name; // ignore this one
		});
		// delete white space, but prserve space in [chars]
		txt = txt.replace(/\\\.|\[([^\]\\]*(\\.)?)*\]|[ \t\n\r]+/g, function(span) {
			var c = span[0];
			if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
				return ''; // delete
			}
			return span; // preserve as-is
		});
		return txt;
	}

	var RULEMAX = 100; // max rule depth, to catch looping..

	grip.parse = function (input, trace) {	//RWW: additional error generation
		this._lastMatch = null;
		var begin = this._rules[0]; // start at first rule...
		if (!begin) {
			//RWW: console.log("No rules defined..."); return FAIL;
			throw new Error("Parsing with empty grammar, no rules defined.")
		}

		if (typeof input !== 'string') {
			//RWW: console.log("Can't parse this input:", input); return FAIL;
			throw new Error(["Grammar ", begin.name, " unable to parse:\n\t", input].join())
		}

		if (!this._compiled) {
			var errors = this._compile()
			if (errors.length > 0)
				throw new Error(errors.unshift(begin.name," grammar errors:").join('\n\t'))
		}

		var parser = new Parser(this, input, trace);

		parser.result = parser.parseRule(begin.name);

		if (parser.result != FAIL) this._lastMatch = input.substr(0, parser.pos)
		
		if (this._matchAllInput && (parser.pos < input.length)) {
			parser.showPos(parser.pos, parser._maxFail, "!"+parser._maxRule+" ..."); // fault report...
			return FAIL;
		}

		return parser.result;
	}

	var Parser = function(grit, input, trace) {
		this.grit = grit; // grammar rules
		this.input = input;
		this.pos = 0;
		this._traceFlag = !!trace || grit._actionTraceFlag; // compileRule $ => true
		this._trail = []; // trace stack
		this._last = {}; // rule result memos
		this._maxFail = -1; // maxFail pos
		this._maxRule = undefined; // maxFail rule name
		this._rulecount = 0; // catch RULEMAX loops...
	}

	Parser.prototype = Object.create(Grit.prototype);

	Parser.prototype.parseRule = function (name) {	//RWW: Additional Error generation
		var start = this.pos;
		var result = FAIL;
		if ((this._rulecount+=1) > RULEMAX) this._traceFlag = true; // looping...
		if (this._traceFlag) {
			this._trail.push(name);
			if (this._rulecount > RULEMAX+5) {
				this.reportTrace(start, name);
				throw new Error("Rule depth overflow using grammar "+this.grit._rules[0].name);
			}
		}
		var rule = this.grit._rule[name];
		if (!rule) { // undefined rule...
			//RWW: console.log("Undefined rule: "+name+", in grammar: "+this.grit._rules[0].name);
			throw new Error(["Undefined rule: ", name, " in grammar ", this.grit._rules[0].name].join(''))
		} else if (rule instanceof RegExp) {
			result = this.leafNode(name, rule);
		} else if (typeof rule === 'function') {
			result = rule.call(this, this.input.slice(start), this.grit._actArgs[name] );
		} else if (rule instanceof Array) { // Grit.parse() tree
			result = GRIT.exec(this, rule); // GRIT grammar **** Grit grit ****
		} else {
			//RWW: console.log("Bad rule type: ", name, "\n", rule);
			throw new Error(["Rule ", name, "invalid:\n\t ", rule].join(''))
		}
		this._rulecount -= 1;
		if (result !== FAIL) {
			var node = this.ruleNode(result, name, start); // array node;
			this._last[name] = node; // TODO node to use as pack-rat memo
			var action = this.grit._action[name];
			var product = result; // or result from action...
			if (action) {
				try {
					product = action.apply(this, result);
				} catch (err) {
					//RWW: console.log("Rule "+name+" :: semantic action failed: "+err);
					throw new Error(["Rule ", name, " :: semantic action failed:\n\t", err].join(''));
				}
				if (this.grit._actionTraceFlag && this.grit._actionTrace[name]) {
					this.reportTrace(start, name, result, product);
				}
				if (product === null || product === undefined) product = FAIL;
			}
			if (this._traceFlag) {
				if (!this.grit._actionTraceFlag) this.reportTrace(start, name, result, product);
				this.traceClean(1);
			}
			if (product !== FAIL) { return product; }
		}
		if (this._traceFlag) { this._trail.push("!"); }
		if (start > this._maxFail) {
			this._maxFail = start; // for: ^  ^ fault report span
			this._maxRule = name;
		}
		return FAIL;
	}

	Parser.prototype.traceClean = function (n) {
		if (n < 1 && this._trail[this._trail.length-1] !== '!') return;
		var x = this._trail.pop();
		n = (x === '!')? n+1 : n-1;
		this.traceClean(n);
	}

	Parser.prototype.ruleNode = function (node, name, start) { // TODO fix jul19, 2015 for metamark
		node.rule = name;
		node.index = start;
		// node.input = this.input;
		node.lastIndex = this.pos;
		return node;
	}

	Parser.prototype.leafNode = function (name, regex) {
		regex.lastIndex = 0; // reset index
		var mx = regex.exec(this.input.slice(this.pos));
		if (!mx) return FAIL;
		mx.rule = name;
		if (mx.input.length > 6) mx.input = mx.input.slice(0,3)+'...'
		// mx.input = null; // clutter in trace, redundant info.. or delete?
		mx.index = this.pos; // more useful for debug..
		this.pos += mx[0].length;
		return mx;
	}

// -- parser trace reporting ------------------------------------------------------------------

	Parser.prototype.reportTrace = function (start, name, result, product) { // print trail stack....
		var trail = start+'..'+this.pos+" "+this._trail.join(' ');
		this.showPos(start, this.pos, trail);
		console.log(result);
		if (product !== result) {
			console.log("=>",product);
		}
		console.log();
	}

	Parser.prototype.showPos = function(start, pos, trail) { // report pos...
		var txt = this.input;
		var sp = "                                                           ";
		var span = "";
		var k = (pos-start > 40)? pos : start;
		if (pos>k) span = sp.slice(0,pos-start-1)+"^"; // ^ ...span... ^
		span += " "+trail;
		if (k>30) {
			console.log("..."+txt.slice(k-30,k+30).replace(/[\n\r]/g,'¬')
					.replace(/[\t]/g,'›').replace(/[\x00-\x1F]/g,'◊'));
			console.log(sp.slice(0,33)+"^"+span);
		} else {
			console.log(txt.slice(0,k+64).replace(/[\n\r]/g,'¬')
				.replace(/[\t]/g,'›').replace(/[\x00-\x1F]/g,'◊'));
			console.log(sp.slice(0,k)+"^"+span);
		}
		return true;
	}


//  == Grit grammar bootstrap =============================================

// GRIT instance to parse Grit grammar rules.....

	var GRIT = new Grit(
		// these four functions are a hand coded bootstrap
		// " exp   := seq ('/' seq)* ",
		// " seq   := (pred? term rep?)+ ",
		// " term  := rule / quote / group ",
		// " group := '(' exp ')' ",
		" exp   :~ \\s* ", // dummy start rule to begin
		" pred  :~ \\s* ([&!]) ",
		" rep   :~ ([+*?]) \\s* ",
		" rule  :~ \\s* (\\w+) \\s* ",
		" quote :~ \\s* (?: ['] ([^']+) ['] | [\"] ([^\"]+) [\"]) \\s* "
	);

	GRIT._compile(); // for the RegExp rules

	GRIT._rule.exp = function () {
		var start = this.pos; // this = parser
		var seq = GRIT._rule.seq.call(this);
		if (seq === FAIL) return GRIT._faultReport(this);
		var exp = []; // result node..
		exp.rule = 'exp';
		while (seq !== FAIL) {
			exp.push(seq);
			if (!this.leafNode("",/^\s*\/\s*/g)) break;
			seq = GRIT._rule.seq.call(this);
		}
		if (start === 0 && (this.pos < this.input.trim().length)) {
			return GRIT._faultReport(this);
		}
		return exp;
	}

	GRIT._rule.seq = function () { // seq := (pred? term rep?)+
		var start = this.pos;
		var terms = [];
		while (true) {
			var pos = this.pos;
			var pred = this.parseRule('pred') || []; // pred?
			var term = GRIT._rule.term.call(this);
			if (term === FAIL || this.pos === pos) break;
			terms.push(pred);
			terms.push(term);
			var rep = this.parseRule('rep') || []; // rep?
			terms.push(rep);
		}
		if (terms.length < 1) {
			this.pos = start;
			return FAIL;
		}
		terms.rule = 'seq';
		return terms;
	}

	GRIT._rule.group = function () {
		if (!this.leafNode("",/^\s*[(]\s*/g)) return FAIL;
		var res = this.parseRule('exp');
		if (!this.leafNode("",/^\s*[)]\s*/g)) return FAIL;
		return res;
	}

	GRIT._rule.term = function () {
		var result = this.parseRule('rule');
		if (result !== FAIL) return result;
		result = this.parseRule('quote');
		if (result !== FAIL) return result;
		return this.parseRule('group');
	}

	GRIT._faultReport = function (parser) { //rule, input, pos
		var rule = parser.grit._rules[0];
		var input = parser.input;
		var pos = parser.pos;
		var nametype = rule.name+" "+rule.type+" ";
		console.log("Bad rule: "+nametype+input);
		var sp = "                                                           ";
		console.log("          "+sp.slice(0,nametype.length+pos)+"^");
		return FAIL;
	}


// -- exec => parse with rule parse tree ----------------------------------------------------

	GRIT.exec = function (parser, ruleTree) {
		// console.log(this);
		var fn = this.do[ruleTree.rule]; // GRIT rule do functions
		if (fn) return fn.call(this, parser, ruleTree);
		console.log("Grit exec missing do function for: "+ruleTree.rule);
		return FAIL;
	}

	GRIT.do = {};

	GRIT.do.exp = function (parser, ruleTree) { // exp -> seq ('/' seq)*
		var start = parser.pos;
		for (var i=0; i<ruleTree.length; i++) {
			var seq = this.exec(parser,ruleTree[i]);
			if (seq !== FAIL) return seq;
			parser.pos = start;
		}
		return FAIL;
	}

	GRIT.do.seq = function (parser, ruleTree) { // seq := (pred? term rep?)+
		var start = parser.pos;
		var terms = [];
		for (var i=0; i<ruleTree.length; i+=3) {
			var nxt = parser.pos;
			var pred = ruleTree[i];
			var term = ruleTree[i+1];
			var rep = ruleTree[i+2];
			var result = this.exec(parser,term);
			if (pred.length>0) {
				if (rep.length>0) console.log("Unexpected repeat operator: ",pred[0]+term+rep[0]);
				parser.pos = nxt; // zero advance...
				if ((pred[1] === '&' && result !== FAIL) || (pred[1] === '!' && result === FAIL)) {
					terms.push([]);
					continue;
				}
				return FAIL;
			}
			if (rep.length>0) { // ?*+  rep?
				if (rep[1] === '+' && result === FAIL) {
					parser.pos = start;
					return FAIL;
				}
				var reps = [];
				while (result !== FAIL && parser.pos > nxt) {
					nxt = parser.pos;
					reps.push(result);
					if (rep[1] === '?') break;
					result = this.exec(parser, ruleTree[i+1]);
				}
				terms.push(reps);
				continue;
			}
			if (result === FAIL) {
				parser.pos = start;
				return FAIL;
			}
			terms.push(result);
		}
		return terms;
	}

	GRIT.do.rule = function (parser, ruleTree) { // \s* (rule) \s*
		return parser.parseRule(ruleTree[1]);
	}

	GRIT.do.group = function (parser, ruleTree) {
		return this.do.exp.call(this, parser, ruleTree);
	}

	GRIT.do.quote = function (parser, ruleTree) {
		var qt = ruleTree[0].trim(); // 'xxx'
		var rule = parser.grit._rule[qt];
		if (!rule) { // memo...
			var str = ruleTree[1] || ruleTree[2]; // '...' | "..."
			var regex = new RegExp("^\\s*("+str.replace(/([^a-zA-Z0-9])/g,"\\$1")+")\\s*"); // TODO improve..
			parser.grit._rule[qt] = regex;
		}
		return parser.parseRule(qt);
	}


// pretty print syntax tree.....................................................

	grip.show = function (term, indent) {
		if (!term || term === true) return '';
		if (typeof term === 'string') return term;
		var name = term.rule;
		if (!name) {
			name ='_'+this._atIndex(term); //((typeof idx === 'number')? idx : '');
		}
		var str = '';
		str = indent? '\n' : '';
		indent = indent || "";
		str += indent+name;
		indent += "  ";
		for (var i=0; i<term.length; i++) {
			if (!term[i]) {
				str += ' ""';
			} else if (typeof(term[i]) === 'string') {
				if (i>0) str += ',';
				var txt = term[i];
				if (i === 0 && txt.length > 32) {
					txt = txt.slice(0,20)+" ... "+txt.slice(txt.length-10);
				} else if (i > 0 && txt.length > 16) {
					txt = txt.slice(0,7)+" ... "+txt.slice(txt.length-7);
				}
				str += ' "'+txt.replace(/[\n\r]/g,'¬').
					replace(/[\t]/g,'›').replace(/[\x00-\x1F]/g,'◊')+'"';
			} else {
				str += indent+this.show(term[i], indent);
			}
		}
		return str;
	}

	grip._atIndex = function(term) {
		if (!term) return '';
		if (typeof term.index === 'number') return term.index;
		if (!term[0] || term[0] === term) return '';
		return this._atIndex(term[0]);
	}


// Helper type translators ======================================================================

// Parser delegates to Grit so semantic actions can access these combinatiors via this.xxx

	grip.string = function (m, n) {  // TODO PEG rules => join ?
		return n||m;
	}

	grip.number = function (m, n) {
		return Number(n||m);
	}

	grip.trim = function (a, b) {
		return b||a;
	}

	grip.join = function (list) {
		if (!list) return "";
		if (typeof list === 'string') return list;
		for (var i=0; i<list.length; i++) {
			var term = list[i];
			if (typeof term === 'string') continue;
			list[i] = this.join(term);
		}
		return list.join('');
	}

	grip.flatten = function (arr) {
		var that = this;
		if (Array.isArray(arr)) {
			return arr.reduce(function (flat, toFlatten) {
				return flat.concat(that.flatten(toFlatten));
			}, []);  //RWW: }, []).join('');
		} else {
			return arr;
		}
	}

// grip.flatten = function (list) {
// 	// if (!list || typeof list === 'string)') return list;
// 	for (var i=0; i<list.length; i++) {
// 		var term = list[i];
// 		if (!term || term === true || !term.rule) { // rule fail -> null or false
// 			return list.slice(0,i).concat(this.flatten(term),this.flatten(list.slice(i+1)));
// 		}
// 	}
// 	return list;
// }
// grip.flatten = function (result) {
//     return (function (arr) {
//       return arr.reduce(function (flat, toFlatten) {
//         return flat.concat(Array.isArray(toFlatten) ?
//             this.flatten(toFlatten) : toFlatten);
//       }, []);
//   })(result).join("");
// }

// == Expose Grit ============================================================================================

	if (typeof module !== 'undefined' && typeof exports === 'object') {
		module.exports = Grit;
	} else if (typeof define === 'function' && define.amd) {
		define(function() { return Grit; });
	} else {
		this.Grit = Grit;
	}

}).call(function() {
	return this || (typeof window !== 'undefined' ? window : global);
}());

// console.log("grit.js.....");
// var Grit = require("./grit.js");

// console.log("Grit 2015-05, run test.js to try it out....");
