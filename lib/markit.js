// -- markit: framework module for publishing markup to HTML, contains MyWord ----

/*	The MIT License (MIT)
 *
 *	Copyright (c) 2016,2017 Peter Cashin, Rick Workman
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

;(function () {

	/*
	 *  0. Some helper functions for I/O
	 */

	var loadpath = [''];               	// base for relative URLs, acts like a stack

	function directory(url) {
		return url.substring(0, url.lastIndexOf('/') + 1)
	} // directory(url)

	function composeURL(path) {
		var url = path.trim();
		return ((url.charAt(0) === '/') || (url.indexOf('://') > 0)) ?
			url :				// partial or absolute URL
			loadpath[0] + url;	// relative URL
	} // composeURL(path)

	function fileContent(url) { // returns content or throws exception
		var status = 0;
		if (typeof XMLHttpRequest != 'undefined') {
			var request = new XMLHttpRequest();
			request.open("GET", url, false);   //synchronous IO, requires Worker mode in browsers
			request.setRequestHeader("Accept","text/*,*/*")
			request.onerror = function () {
				status = 404
			};
			request.send();   //; console.log(request.status,url,"["+request.responseText.length+"]")
			status = ((status == 0) ? request.status : status );   //; console.log("status=",status)
			if ((status === 200 || status === 0)) {
				//console.log(url+"["+request.responseText.length+"]="+request.responseText.slice(0,48))
				return request.responseText
			} else {
				throw new Error(["Reading '", url, "':\n\t status=", status].join(''));
				//ES6: throw new Error(`Reading '${url}' status=${status}`)
			}
		} else {	// try Nodejs file system
			return fs.readFileSync(url, "utf8");
		}
	} // fileContent(url)

	function loadScript(url) {
		// Note: importScripts not functional in extensions for some browsers
		//   geval(fileContent(url)) seems to work in almost all cases where eval() is permitted
		//if (typeof importScripts != 'undefined') {
		//	importScripts(url)
		//} else {
			// need to ensure global translators are accessible via global space
			// using require() problematic: no global name, relative url needs ./
			// fails in some cases?:	 new Function(fileContent(url))()
			var geval = eval; geval(fileContent(url));	// eval() in global scope, independent of module scheme
		//}
		return null		// return a defined value
	} // loadScript(url)

	function reportError(errorInfo){		// errorInfo = [String..]
		if (console) console.error(errorInfo.join(''))
	}


	/*
	 *  1. Init environment - load Grit and if executing as a Worker, setup message handler
	 */

	var contextList = []				// persistent, immutable contexts for dynamic updates
	var workerMode = false; 		// Note, due to syncIO, file ops only work in Worker mode
	var workerID = '';
	var Grit;
	// Set workerMode; true if functioning as a Worker
	try {
		workerMode = (self instanceof WorkerGlobalScope)
	} catch (err) {}

	if (workerMode) {// When used in Worker mode
		// Load Grit - 	grit.js assumed to be co-located
		try {
			// console.log('Worker location=',location.href)
			// Note extension code must insert _extensionHref in WorkerGlobalSpace if different from location.href
			loadScript(directory((typeof _extensionHref === 'undefined') ? location.href : _extensionHref) + "grit.js")
		} catch (err) {
			throw new Error(["loading grit.js: ", err.message].join(''))
		}
		Grit = self.Grit;
		onmessage = function (msg) {
			var output;                 //; console.log("Worker:" + workerID + " received request for " + msg.data[0])
			try {
				loadpath = [directory(msg.data[0])];   		// msg.data is [doc.href, transform, content, contextID]
				// console.log('contextID=',msg.data[3])
				context = contextList[msg.data[3]]
				output = (msg.data[1] === 'metamark')
										? (markit.setDefaultLingo(msg.data[2]))
										: markit(msg.data[1], msg.data[2]);   	// see markit() for spec
			} catch (err) {
				output = markit('errorString', err.message)
			}
			postMessage(output)
		};
		workerID = Date.now()
	} else {	// Node.js & CommonJS module system
		try {
			var fs = require('fs');
			// Load Grit - 	grit.js assumed to be co-located
			Grit = require("./grit.js");
			// define self for transform lookup
			if (typeof self === 'undefined')
				global.self = global
		} catch (err) {
			throw new Error(["Unsupported platform - upgrade browser or use CommonJS module system: ", err.message].join(''))
		}
	}
	if (console) console.log("Worker:" + workerID);


	/*
	 *  2. Context class for managing defs
	 */

	var Ctx = function (parent) {
		this.parent = parent;	// link to parent context, null if root
		this.index = {};   		// label to dataType map
		this.types = {};    	// dataType to transform map
	}; // new Ctx(parent)

	Ctx.prototype = {};

	// create a new (nested) context
	Ctx.prototype.push = function () {
		return new Ctx(this)
	}; // Ctx.push(blks)

	// return parent context
	Ctx.prototype.pop = function () {
		return this.parent
	}; // Ctx.pop()

	// add new label definition : (success returns the label definition; duplicates return null and are ignored)
	Ctx.prototype.addLabelDef = function (label, labelDef) {
		var existing = this.index[label]
		if (existing) {
			return null
		} else {
			this.index[label] = labelDef
		  return labelDef
		}
	}; // Ctx.addLabelDef(label, dataType)

	// lookup label definition associated with a label
	Ctx.prototype.labelDef = function (label) {
		var ldef = this.index[label];
		return (typeof ldef === 'undefined') ?
			((this.parent) ? this.parent.labelDef(label) : null) :
			((ldef==='')? null : ldef)	// empty string signifies an (temporarily) undefined label
		/* TODO: cleanup, was
		if (ldef !== null) return (ldef==='')?null:ldef;
		if (this.parent) return this.parent.labelDef(label);
		return null
		//*/
	}; // Ctx.labelDef(label)

	// add new type definition (success returns the type definition; duplicates return null and are ignored)
	Ctx.prototype.addTransform = function (type, transform) {
		var existing = this.types[type]
		if (existing) {
			return null
		} else {
			this.types[type] = transform
			return transform
		}
	}; // Ctx.addTransform(type, transform)

	// lookup a transform associated with type
	Ctx.prototype.transform = function (type) {                  // lookup data-type translator fn
		if (type) {
			var transform = this.types[type];                        // first search context chain
			if (transform) return transform;                         // found in this context
			if (this.parent) return this.parent.transform(type);    // found in parrent context
			try {                                                   // global translators are transforms
				var names = type.split('.')		// decompose object path and dereference
				transform = self
				while (names.length > 0) transform = transform[names.shift()]
				// console.log(workerID + ":globalTranslator(" + type + ")=" + transform)
				if (typeof transform == 'function') return transform
			} catch (err) {
			}	                                    // ignore errors
		}
		return null;			                                    // any errors result in null
	}; // Ctx.transform(type)

	// check if there are any  defintitions...
	Ctx.prototype.hasDefinitions = function () {
		return (Object.keys(this.index).length > 0 || Object.keys(this.types).length > 0)
	}

	// Create empty root context and add framework dataTypes
	var context = new Ctx(null, []);

	context.addTransform('errorString', function (content) {			// type defintion for error messages
		reportError(["markit(", workerID, "):", content]);
		return ["\n*** Error *** ", content, "\n"].join('')
	});


	/*
	 *  3. Global function : markit(type, content, parms)
	 *  returns the string result of calling the transform, in all other cases an Error is thrown for
	 *  	no transform function defined, if transform doesn't return a string, or if transform throws Error
	 */

	var recursionStack = []														// private state used to detect infinite loops in lingos
	var recursion_errString = "INFINITE RECURSION: "	// used by applyLabel() to provide meaningful error message

	function markit(type, content, parms) {
		// console.log('markit:',type, content, parms)
		var marker = ["'", type, "': ", content].join('')	// marker contains type and content
		if (recursionStack.indexOf(marker) >= 0) {				// if marker already on stack, there's a loop
			throwError([recursion_errString, marker])				// so throw an error with 'special' message prefix
		}
		recursionStack.push(marker)	// add call to recursionState
		if (type) {
			var transform = context.transform(type);     //; console.log(type,"=",transform)
			if (transform) {
				var output
				try {
					output = transform.call(null, content, parms);
				} catch (err) {
					throwError([" in transform for type ", type, ":\n\t", err.message ])
				}
				if (typeof output === 'string') { // Expecting a string result
					recursionStack.pop()	// successful exit, restore recursionState
					return output
				} else {
					throwError([" bad result from transform for type ", type, " => ", JSON.stringify(output)])
				}
			} else {
				throwError([" transform for type ", type, " not defined."])
			}
		} else {
			throwError([" illegal type ", JSON.stringify(type), "."])
		}

		function throwError(msg) {
			recursionStack = []			// reset recursionState
			throw new Error(msg.join(''))	// Note: exceptions rethrown.
		} // throwError(msg)
	} // markit(type, content, parms)


	/*
	 *  4. compileGrammar(grammar)
	 *  compile a grammar and throw an Error if errors reprorted
	 */

	var compileGrammar = function (grammar) {
		var errors = grammar._compile();
		if (errors.length > 0) {
			errors.unshift(grammar._rules[0].name + " compile failed:");	//; console.log('grammar=',grammar,'\nerrors=',errors)
			throw new Error(errors.join('\n\t'))
		}
	};	// compileGrammar(grammar)


	/*
	 *  5. Transform: metawordParse(content)
	 *  label and type defintions
	 */

	var metaword = new Grit(
		"metaword   := (blank / labeldef / fundef / gramdef / uses / js / css / comment / undefined)* ",
		//"labeldef	:~ (%word)%ws= (?:%ws(%tag))? (?:%ws(%word)(%block)?)? \\s* :: label(def,label,tag,type,parmString) ",
		"labeldef	:~ (%word)%ws= (?:%ws(%tag))? (?:%ws(%block)?)? \\s* 		:: label(def,label,tag,transform) ",
		"fundef		:~ (%name)\\s+:{2}(%block) 		:: func(_,type,func) ",
		"gramdef    :~ (%name)\\s+:%block 			:: gram(rules,rule) ",
		"uses			:~ @import\\s+(%block)    		:: uses(_,urls) ",
		"js				:~ @javascript\\s+(%block)    :: js(_,js) ",
		"css			:~ @css\\s+(%block)    				:: css(_,css) ",
		"blank		:~ [ \\t]* %nl								:: (_) => {return []} ",
		"comment	:~ // %line %nl?            	:: (function (_) {return []}) ",
		"undefined	:~ ([ \\t]* [^\\n\\r]+)     :: undefined(_,statement) ",
		"tag			:~ [<][^>]*[>]",
		"block		:~ %line %insetline* ",
		"insetline	:~ (?: [ \\t]* %nl | (%ws %line)) ",
		"word			:~ \\S+ ",
		"name			:~ [a-zA-Z]\\w* ",
		"line			:~ [^\\n\\r]* ",
		"ws				:~ [ \\t]+ ",
		"nl				:~ (?:\\r \\n? | \\n)"
	);

	metaword.label = function (definition, label, tagInfo, transformDef) {	//TODO typeName, parms) {
		// label(def,label,tag,transform)
		// construct label definition: { tag:tagString, etag:endTag, type:typeName, parmString:parms}
		var tag = ((tagInfo) ? tagInfo.trim().replace(/\s+/g, " ") : "");	// replace instances of whitespace with single space
		var etag = ''	// empty end tag for now, will be filled in later if necessary
		var transform = (transformDef) ? transformDef.trim() : ''
		//var type = (typeName) ? typeName : null
		//var parmString = (parms) ? parms : ''
		// console.log(label,'=       tag:',tag,' type:',type,' parmString:',parmString)
		if (tag) {		// begin tag defined
			if (tagInfo.substr(-2) === '/>') {	// closed tag
				if (transform)					// can't have a closed tag with a content type (will never be called)
					return markit('errorString', ["Closed tag cannot be used with a transform.\n\t", definition.trim()].join(''));
			} else {							// open tag
				etag = ["</", tag.match(/^<\s*(\S+)[^>]*>$/)[1], ">"].join('')
			}
		}
		// empty label defintions are empty strings signifying undefined
		// used to undefine a label that was defined in a parent context.
		// Duplicate labels (null returned from addLabelDef) flagged as errors
		return (context.addLabelDef(label, (tag || transform) ?
												{tag: tag, etag: etag, transform: transform} :
												'') !== null) ?
						[] :
						markit('errorString', ["Duplicate definition for '",label,"' ignored.\n\t", definition.trim()].join(''))
		/* TODO: was
		if (tag || transform) {
			context.addLabelDef(label, {tag: tag, etag: etag, transform: transform, parmString: parmString})
			return[]
		}
		else
			return markit('errorString', ["Empty label definition:\n\t", definition.trim()].join(''));
		*/
	} // metaword.label(definition, label, tag, transformName, parms)

	metaword.func = function (_, type, func) {
		var output = []		// nominal output
		try {
			var geval = eval	// global eval
			var transform = geval(func)
			if (typeof transform === 'function') {
				if (!context.addTransform(type, transform))
					throw new Error(["Duplicate definition for '",type,"' ignored.\n\t", func.trim()].join(''))
			}
			else
				throw new Error(["Invalid transform for '", type, "', ", func.trim(), " is not a function."].join(''))
		} catch (err) {		// compile errors on new types
			output = markit('errorString', err.message)
		}
		return output
	}; // metaword.func(_, type, func)

	metaword.gram = function (rules, rule) {
		var output = []		// nominal output
		try {
			var gram = new Grit(rules);		//; console.log(gram)
			compileGrammar(gram);
			if (!context.addTransform(rule, function(content, parmString) {
					// if (parmString)
					// 	console.log("Warning: rule " + rule + " - transform parameters `" + parmString + "` will be ignored." )
					return gram.parse(content, parmString)
					})
			) 	throw new Error(["Duplicate definition for '", rule, "' ignored.\n\t", rules.split('\n')[0]].join(''))
		} catch (err) {		// compile errors on new types
			output = markit('errorString', err.message)
		}
		return output
	}; // metaword.gram(rules, rule)

	metaword.uses = function (_, urls) {
		var out = [];
		var urlist = urls.trim().split(/\s+/);
		for (var u=0; u < urlist.length; u++) {
			out.push(dispatchImportHandler(urlist[u]))
		} // for
		return out
	}; // metaword.uses(_, urls)

	metaword.js = function (_, js) {
		return markit('metajs', js)
	}; // metaword.js = function (_, js)

	metaword.css = function (_, css) {
		return markit('metacss', css)
	}; // metaword.css = function (_, css)

	metaword.undefined = function (_, statement) {
		//console.log('undef=',statement, statement.length, statement.charCodeAt(0));
		return markit('errorString', ["Unrecognized metaword statement:\n\t", statement].join(''));
		//ES6:                               `Unrecognized metaword statement: ${statement}`)
	}; // metaword.undefined(_, statement)

	compileGrammar(metaword);

	var importHandlers = {}

	// 'public' function to bind an import handler to a filetype (i.e., suffix, including '.', e.g., .css, .js
	function addImportHandler(fileType, handler) {
		importHandlers[fileType] = handler
	} // addImportHandler(fileType, handler)

	// 'public' function to select import handler based on URL suffix, and call it
	//   also handles relative URL semantics using composeURL and loadpath
	//   returns HTML string (possibly an error report) for inclusion in document
	function dispatchImportHandler(url) {
		var returnValue
		var absurl = composeURL(url)
		var fileSuffix = absurl.substring(absurl.lastIndexOf('.'))
		var importHandler = importHandlers[fileSuffix]
		if (importHandler) {
			loadpath.unshift(directory(absurl))	// push new loadpath
			returnValue = importHandler.call(null, absurl)
			loadpath.shift()					// pop loadpath
		} else {
			returnValue = markit('errorString', ["Importing '", absurl, "', unsupported file type: ", fileSuffix].join(''))
		}
		return returnValue
	} // dispatchImportHandler(url)

	addImportHandler('.mmk', metamarkHandler)

	addImportHandler('.txt', metamarkHandler)

	addImportHandler('.js', function(url) {
		var returnValue
		try {								// console.log("loadScript "+ absurl)
			returnValue = loadScript(url)	// return value will be null
		} catch (err) {	 // console.log("err.message=",err.message,"err.name=",err.name,"err=",err)
			returnValue = markit('errorString',
				["Loading script '", url, "':\n\t", (err.message || err.name)].join(''));
			//ES6:   `Loading script '${absurl}' ${(err.message || err.name)}`))
		}
		return returnValue
	})

	addImportHandler('.css', function(url) {
		var returnValue
		try {
			var content = fileContent(url);  // needs to be synchronous or frame sizes get mucked up
			//i.e., this doesn't work: out.push(["<style scoped>@import url(", absurl, ");</style>"])
			returnValue = markit('metacss', content)
		} catch (err) { // IO Error
			returnValue = (markit('errorString', ["Loading style '", url, "':\n\t", (err.message || err.name)].join('')))
		}
		return returnValue
	})

	function metamarkHandler(url) {
		var returnValue
		try {
			var content = fileContent(url);  	// needs to be synchronous or frame sizes get mucked up
			// returnValue = markit('metamark', content);	// process metamark
			returnValue = metamarkAdd(content);	// process metamark
		} catch (err) { // IO or markit Error
			returnValue = markit('errorString', ["Reading '", url, "':\n\t", (err.message || err.name)].join(''))
		}
		return returnValue
	} // function metamarkHandler(url)

	function metamarkAdd(content) {
		var output;
		try {       // all exceptions turned into errorString's
			output = metaword.flatten(metaword.parse(content)).join('')
		} catch (err) {
			output = markit('errorString', err.message)
		}
		return output
	} // function metamarkAdd(content)

	context.addTransform('metajs', function (content) {
		return markit('errorString', ['No handler for @javascript: ', content.substring(0,79), ' ...'].join(''))
	});

	context.addTransform('metacss', function (content) {
		return markit('errorString', ['No handler for @css: ', content.substring(0,79), ' ...'].join(''))
	});

	/*********** Everything below this line is predefined markup and could be re-located. **********/
	/*********** See "Dependancy:" comments for API requirements.                         **********/


	/*
	 *  6. Utility function to translate labeled content: applyLabel(label, content)
	 *      If no transform for label, use 'myword'
	 *  returns a string or null(no transform found for label)
	 *  throws errors from markit(transform, content))
	 */

	var applyLabel = function (label, content) {
		//**** Dependancy: context
		var output = null;   												// default for no label definition
		var labelDef = context.labelDef(label);			// {tag: tag, etag: etag, transform: transform, parmString: parmString}
		// console.log("label=",label,"labelDef=",labelDef)
		if (labelDef) {
			//; console.log(label,'::',labelDef,'\n',content)
			if (labelDef.tag && (labelDef.etag === '')) {	// closed tag ignore content (may be sigil label)
				output = labelDef.tag;
				//if (content) console.log("Closed tag '" + labelDef.tag + "'used with non-null content.")
			} else {
				var transformSpec = /^(\S+)([\s\S]*)/.exec(labelDef.transform) // [0]=text,[1]=type,[2]=parmstring
				var result
				try {
					if (transformSpec) {
						if (context.transform(transformSpec[1])) {
							// transform defined, apply transform function
							result = markit(transformSpec[1], content, transformSpec[2].trim())	// transform defined, apply it
						} else {
							// transform present but not defined: error
							result = markit('errorString', ["No defintion for type '", transformSpec[1], "'"].join(''))
						}
					} else {
						// no transform string, use 'myword' as content type
						result = markit('myword', content, '')
					}
					output = [ labelDef.tag, result, labelDef.etag ].join('');	// wrap result
				} catch (err) {	// rethrow any errors after modifying infinite recursion information
					throw new Error((err.message.indexOf(recursion_errString) === 0) ?
													[" Lingo bug, infinite loop applying label '", label, "' to: ", content].join('') :
													err.message
												 )
				}
			}
		}
		return output
	}; // applyLabel(label, content)


	/*
	 *  7. Transform: myword
	 *  create and translate block elements
	 */

	var myword = new Grit(
		"myword  := (blank / block / line nl?)*     :: elems ",
		"block   := label (gap* inset line)+ nl?    :: block ",
		"line    :~ [^\\n\\r]*                      :: (s)=>({line:s}) ",
		"label   :~ (\\S*)                          :: (s)=>s ",
		"inset   :~ [ ]{2,8}|[ ]?\\t                :: (s)=>s ",
		"blank   :~ [ \\t]* %nl                     :: (s)=>({blank:s}) ",
		"gap     :~ ([ ]? %nl)                      :: (s)=>s ",
		"nl      :~ (?: \\n | \\r\\n?)              :: ()=>'' "
	);

	myword.elems = function(elems) {
		return elems.map(function(elem) {return elem[0]});	// flatten and discard any 'nl' empty strings
	};

	var GAP=0, INSET=1, LINE=2;

	myword.block = function(label, lines) {
		label = label || "\t"; // empty label, \t calls insetblock transform
		var min = 8, tab = false; // min space inset....
		for (var i=0; i<lines.length; i+=1) {
			if (i==0 && lines[i][GAP].length == 0) continue; // first line content
			var n = lines[i][INSET].length
			if (lines[i][LINE].length == 0) continue; // blank line
			if (n==1) tab = true
			else if (n<min) min = n;
		}
		var content = "";
		for (var i=0; i<lines.length; i+=1) {
			var ln = lines[i]; // ln = [gap inset line]
			var gap = ln[GAP];   // ["\n", ...]
			for (var j=0; j<ln[0].length; j+=1) { // gap lines...
				if (i==0 && j==0) continue; // skip first line gap nl
				content += gap[j];
			}
			var pad = ln[INSET].length-min
			if (pad>0) content += '         '.slice(0,pad)
			content += ln[LINE].line;
		}
		var open = content[0]; // block content brackets....
		if (open==='{' || open==='[' || open==='(') {
			var close='}])'['{[('.indexOf(open)];
			var ended = (content[content.length-1]===close);
			if (!ended && this.input[this.pos]===close) {
				this.pos += 1;
				content += '\n'+close;
			}
		}
		var labelDef = context.labelDef(label);	 // {transform:typeInfo, tag:tagInfo}
		if (labelDef && /^metamark(\s(\s\S)*)?/.test(labelDef.transform)) { // block of definitons...
			return { report: metamarkAdd(content) };    // report errors
		}
		return { label:label, content:content };
	};

	compileGrammar(myword); // verify grammar, or throw an error

	var mywordParse = function(content, parmstring) {
		//var myContent = (parmstring) ? parmstring : content		// if parmstring defined, use as content
		if (!content) return '';
		var out = [];							// output accumulator
		context = context.push();	// new context for myword blks

		var blocks = myword.parse(content);
		while (blocks.length>0) {							// process blocks array until nothing left
			var blk = blocks.shift()						// get and consume a block from blacks array

			if (blk.label) try {								// == block of content
				var output = (blk.label === '\t') ? markit('insetblock', blk.content) : applyLabel(blk.label, blk.content)
				// Push the output or the 'markedblock' (assume undefined)
				out.push(output ? output : markit('markedblock', [blk.label, '\t', blk.content].join('')))
			} catch (err) {
				out.push(markit('errorString', err.message))	// error in transforming
			} // blk.label

			else if (blk.line) { 								// == line(s) of prose
				var proseContent = [blk.line]
				while (blocks.length>0) { 				// collect lines
					blk = blocks.shift() 						// get next block
					if (blk.line) {									// is it a line?
						proseContent.push(blk.line);	// Yes, add line to content
					} else {
						blocks.unshift(blk); break;		// No, put it back and exit
					}
				}
				try {
					out.push(markit('prose', proseContent.join('\n')))	// parse as prose after re-insering newlines.
				} catch (err) {
					out.push(markit('errorString', err.message))
				}
			} // blk.line

			else if (blk.blank) out.push(markit('blankline', ''))		// == empty line

			else if (blk.report) out.push(blk.report)								// == meta-content and errors

		} // while

		var contextID = ''
		if (context.hasDefinitions()) {		// calculate a conditional contextID
			contextList.push(context)				// persistant context for dynamic updates
			contextID = (contextList.length-1).toString()
		}

		context = context.pop();						// restore previous context
		// Wrap a myword scope around the generated output and return
		return markit('scope', myword.flatten([contextID, '\t', out]).join(''))
	} // mywordParse(content)


// default type defintions for blocks

	context.addTransform('myword', mywordParse); //  **** Dependancy: context, compileGrammar()

	context.addTransform('blankline', function(content) {	// blank line
		return(content + '/n')
	})

	context.addTransform('insetblock', function(content) {	// default transform for inset blocks
		return ['\n', markit('myword',content), '\n'].join('')
		//return ['<div class=insetblock>', markit('myword',content), '</div>'].join('')
	});

	context.addTransform('markedblock', function (notation) {	// dataType for blocks with undefined labels, reconstruct with marked label
		var labelled = /(\S*)\t([\S\s]*)/.exec(notation)		// use tab to separate label from content
		return ['•',markit('text', labelled[1]), '•\t', markit('text', labelled[2].replace(/\n/g, '\n\t')), '\n'].join('')
	})

	context.addTransform('scope', function(content) {	// default transform for scope, just throw away contextID
		return content.substring(content.indexOf('\t') + 1)
	});

	context.addTransform('metamark', function (content) {return ''});			// meta-content not output

	context.addTransform('text', function (content) {return content});		// 'text' is just literal text

	context.addTransform('viz', function (_, parmstring) {return markit('myword', parmstring)}); // for replacement

	/* TODO: ?
	context.addTransform('list', function(content) {	// transform for list grouping:
		//**** Dependancy: context
		var groupBlocks = function(out) { // content of next in group ...
			var currentblk = context.blks[0];
			var blk = context.blks[1];                      // look ahead
			while (blk && blk.blank) {                     // remove blanks
				out.push(markit('blankline', ''))
				context.blks.splice(1,1);
				blk = context.blks[1];
			}
			if (blk) {
				if (blk.label == currentblk.label) {
					context.blks.shift();               // remove current block, matching block now first
					return blk.content;                 // return block content
				}
			}
			return null
		}; // groupBlocks(out)

		var out = [];
		while (content) {       //; console.log("grouping:",content)
			try {
				out.push("<li>", markit('myword', content), "</li>");
			} catch (err) {
				out.push(markit('errorString', err.message))
			}
			content = groupBlocks(out);
		}
		return out.join('');
	});*/

	context.addTransform('include', function(content) { // transform for including content in external resources
														//**** Dependancy: I/O utilities
		var out = []                        //; console.log('@import',content)
		var absurl, url, urlist = content.trim().split(/\s+/);
		for (var u=0; u < urlist.length; u++) {
			url = urlist[u];
			absurl = composeURL(url);	//; console.log('@import ',absurl)
			loadpath.unshift(directory(absurl));			// push new loadpath
			try {
				var fcontent = fileContent(absurl);
				// if there's a label defined for the URL suffix, use its transform, else use 'myword' transform
				var output = applyLabel(url.substring(url.lastIndexOf('.')), fcontent)
				out.push((typeof output === 'string') ? output : markit('myword', fcontent))
			} catch (err) { // IO or translateData Error
				out.push(markit('errorString', ["Reading '", absurl, "':\n\t", (err.message || err.name)].join('')))
			}
			loadpath.shift()							// pop loadpath
		}
		return out.join('')
	});


	/*
	 *  8. Transform: proseParse(content)
	 *  create and translate inline elements
	 */

	var sigilProse = new Grit(
		//RWW "prose       := (space / word / entity / element  / quote / sigil / symb / nota)*  :: prose ",
		"prose       := (space / word / element  / quote / sigil / symb / nota)*  :: prose ",
		"space       :~ \\s+                                         	:: string",
		//RWW "word        :~ [a-z0-9]+ \\s+                               	:: string ",
		"word        :~ [a-zA-Z0-9]+ \\s+                             :: string ",
		//RWW "entity      :~ [^\\s()\\[\\]]+                              	:: entity ",
		"element     := label box                                    	:: element ",
		"label       :~ [^\\s()\\[\\]]*                              	:: string ",
		"box         := paren / brack                                	:: (x) => x ",
		"paren       := '(' (paren/not_paren)* ')'  ",
		"brack       := '[' (brack/not_brack)* ']'  ",
		"quote       := qmark (box/notq)+                          		:: quote ",
		"notq        :~ %qmark | ([\\sa-zA-Z0-9]+) | ([\\s\\S])     	:: notq ",
		"qmark       :~ ([^\\sa-zA-Z0-9()\\[\\]]) \\1*              	:: qstart ",
		"not_paren   :~ [(]?[^()]+          ",
		"not_brack   :~ [\\[]?[^\\[\\]]+    ",
		"sigil       :~ ([^a-zA-Z0-9\\s()\\[\\]]+) ([a-zA-Z0-9]+)     :: sigil ",
		"symb        :~ [^a-zA-Z0-9\\s()\\[\\]]+				              :: symbol ",
		"nota         :~ ([a-zA-Z0-9]+) | ([^\\sa-zA-Z0-9]+) | ([^\\s]+)   :: nota "
	);

	sigilProse.prose = function(content) {
		return this.flatten(content).join('');
	};

	/* RWW
	sigilProse.entity = function(entity) {
		var key = '('+entity+')';
		if (context.labelDef(key)) return sigilProse.elem(key, entity);
		var punct = entity.match(/^(.+)([.,;!?](?:\s|$))/);
		if (!punct) return null; // not an entity
		var key = '('+punct[1]+')';
		if (context.labelDef(key)) return sigilProse.elem(key, punct[1])+punct[2];
		return null; // not an entity
	};*/

	sigilProse.element = function(label, box) { //}, bag) {  // label[box](bag)
		// if (bag[0]) return sigilProse.doubleBrackets(label, box, bag); // label[]() or []() ...
		var content = this.flatten(box[1]).join('');
		if (!label) {  // (...) or [...]
			var output = sigilProse.symbol(content);
			// console.log('box',content)
			//RWW if (!output) return box[0] + markit('myword', content) + box[2]
			if (!output) {
				if (/\s/.test(content)) // a space in the content can't be a label
					output = markit('myword', content)
				else
					output = markit('markedlabel', content)
				output = [box[0], output, box[2]].join('')
			}
			return output;
		}
		var key = label+"()"; // inline label() or label[] ...
		if (!context.labelDef(key)) key = label; // accept generic (block) labels
		if (context.labelDef(key)) { // label[content], and key is defined ....
			var output = sigilProse.elem(key,content);
			if (output != null) return output; // all done...
		} else /*{ // undefined label[content] ....
			// if (label.match(/^([`"*_~])/)) return null; // try for a quote instead..
			if (!label.match(/^([a-zA-Z0-9]+|[^a-zA-Z0-9]+)$/)) return null;
		}*/
		//TODO : all inline labels now left as literals?
		// return ["<span style='font-family:monospace'><mark>", markit('text', label), "</mark>",
		//	markit("text", this.flatten(box).join('')), "</span>"];
		//return markit('text', this.flatten([label, box]).join(''))
		//return this.flatten([markit('markedlabel', label), box[0], markit('myword', content), box[2]]).join('')
		// RWW if no label defintion, emit label as text and try for a symbol on the rest
		return [markit('text', label), markit('myword', [box[0], content, box[2]].join(''))].join('')
	};

	sigilProse.qstart = function(mark,m,n) {
		var k = this.pos; // after mark
		var i = this.pos - mark.length;
		if (i>0 && this.input[i-1]!==' ') return null; // not a word start
		var key = mark+'()'+mark; // "()"
		if (!context.labelDef(key)) return null;
		// console.log('qstart',mark,m,n)
		sigilProse.qmarker = mark;
		return mark;
	};

	sigilProse.notq = function(x,m,a,z) {
		// console.log('notq',x,'m=',m,'a=',a,'z=',z)
		var nxt = this.input[this.pos];
		if (nxt && nxt.match(/^[a-zA-Z0-9]/)) return x;
		if (!x || x === sigilProse.qmarker) return null;
		return x;
	};

	sigilProse.quote = function(qmark, xs) {
		if (this.input.indexOf(qmark, this.pos)!==this.pos) return null
		this.pos = this.pos+qmark.length;
		var content = this.flatten(xs).join('')
		// console.log('quote',qmark, content ,this.input.indexOf(qmark, this.pos)-this.pos);
		var key = qmark+'()'+qmark;
		if (!context.labelDef(key)) return null;
		return sigilProse.elem(key,content);
	};

	sigilProse.sigil = function(sigil) {
		// console.log('sigil',sigil)
		var key = '('+sigil+')'; // (.foo)
		if (context.labelDef(key)) return sigilProse.elem(key, sigil);
		return null; // not a sigil
	};

	sigilProse.symbol = function(symb) {
		// console.log('symb',symb)
		var key = '('+symb+')';
		if (context.labelDef(key)) return sigilProse.elem(key, symb);
		return null; // not a symbol markit('text',symb);
	};

	sigilProse.nota = function(x,word,symb,other) { // none of the above...
		if (other) console.log('nota',x,word,symb,other)
		if (symb) x = markit('text', x);		// x.replace('<','&lt;');
		return x;
	};



		sigilProse.elem = function(label, content) {
		var output;
		try {
			output = applyLabel(label, content)
		} catch (err) {
			output = markit('errorString', err.message)
		}
		return output;
	};

	compileGrammar(sigilProse); // verify grammar, or throw an error

	var proseParse = function(content) {
		return sigilProse.parse(content);
	}; // proseParse(content)

	context.addTransform('prose', proseParse);       // transform for prose,  **** Dependancy: context, compileGrammar()

	context.addTransform('markedlabel', function(content) {  // default transform for marking undefined labels = no marking
		return markit('myword', content)
	});

	/*
	 *  9. export.....
	 */

	contextList = [context]													// make base context persistant

	markit.setDefaultLingo = function(lingo) {	// *** This cannot be called from via markit(), directly or indirectly
		// Note: This check is a little fragile as it depends on the format of the stack trace.
		//       If it encounters an unknown format, it will permit the operation.
		//       Function.caller cannot be used to build a call stack if recursion occurs
		try {Error.stackTraceLimit = Infinity} catch (err) {}		// Required for Chrome (at least)
		var stackTrace = '\n' + new Error().stack		 //;	console.log(stackTrace)
		if ((stackTrace.indexOf('\nmarkit@') === -1) && (stackTrace.indexOf('at markit ') === -1)) {
			while (context.parent !== null) context.pop()		// discard all but base context
			context = context.push()		// push a new context for the default lingo
			contextList = [context]			// reset contextList with the default lingo
			return metamarkAdd(lingo)		// add the default lingo
		} else return markit('errorString','setDefaultLingo() cannot be used by a transform.')
	} // setDefaultLingo(lingo)

	if (typeof module !== 'undefined' && typeof exports === 'object') {
		module.exports = markit;
	} else if (typeof define === 'function' && define.amd) {
		define(function () {
			return markit;
		});
	} else
		this.markit = markit;   // global translator markit(transformName, content)

//}();
}).call(function() {
	return this || (typeof window !== 'undefined' ? window : global);
}());
