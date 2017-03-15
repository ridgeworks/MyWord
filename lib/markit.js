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

	var loadpath = [''];                 // base for relative URLs, acts like a stack

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
			var html;                 //; console.log("Worker:" + workerID + " received request for " + msg.data[0])
			try {
				loadpath = [directory(msg.data[0])];   		// msg.data is [doc.href, transform, content, contextID]
				// console.log('contextID=',msg.data[3])
				context = contextList[msg.data[3]]
				html = (msg.data[1] === 'metamark')
										? (markit.setDefaultLingo(msg.data[2]))
										: markit(msg.data[1], msg.data[2]);   	// see markit() for spec
			} catch (err) {
				html = markit('errorString', err.message)
			}
			postMessage(html)
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

	var Ctx = function (parent, blks) {
		this.parent = parent;	// link to parent context, null if root
		this.blks = blks;    	// from parse tree, no access methods
		this.index = {};   		// label to dataType map
		this.types = {};    		// dataType to transform map
	}; // new Ctx(parent)

	Ctx.prototype = {};

	// create a new (nested) context for blks
	Ctx.prototype.push = function (blks) {
		return new Ctx(this, blks)
	}; // Ctx.push(blks)

	// return parent context
	Ctx.prototype.pop = function () {
		return this.parent
	}; // Ctx.pop()

	// add new label definition : (will overwrite if duplicate)
	Ctx.prototype.addLabelDef = function (label, labelDef) {
		this.index[label] = labelDef
	}; // Ctx.addLabelDef(label, dataType)

	// lookup label definition associated with a label
	Ctx.prototype.labelDef = function (label) {
		var ldef = this.index[label];
		if (ldef) return ldef;
		if (this.parent) return this.parent.labelDef(label);
		return null
	}; // Ctx.labelDef(label)

	// add new transform name and associate it with a transform (will overwrite if duplicate)
	Ctx.prototype.addTransform = function (name, transform) {
		this.types[name] = transform
	}; // Ctx.addTransform(name, transform)

	// lookup a transform associated with name
	Ctx.prototype.transform = function (name) {                  // lookup data-type translator fn
		if (name) {
			var transform = this.types[name];                        // first search context chain
			if (transform) return transform;                         // found in this context
			if (this.parent) return this.parent.transform(name);    // found in parrent context
			try {                                                   // global translators are transforms
				var names = name.split('.')		// decompose object path and dereference
				transform = self
				while (names.length > 0) transform = transform[names.shift()]
				// console.log(workerID + ":globalTranslator(" + name + ")=" + transform)
				if (typeof transform == 'function') return transform
				// TODO var t = self[name]		//; console.log(workerID + ":globalTranslator(", name, ")=", t)
				// if (typeof t == 'function') return t
			} catch (err) {
			}	                                    // ignore errors
		}
		return null;			                                    // any errors result in null
	}; // Ctx.transform(name)

	// check if there are any  defintitions...
	Ctx.prototype.hasDefinitions = function () {
		return (Object.keys(this.index).length > 0 || Object.keys(this.types).length > 0)
	}

	// Create empty root context and add framework dataTypes
	var context = new Ctx(null, []);

	var contextList = [context]				// persistent, immutable contexts for dynamic updates

	context.addTransform('text', function (content) {		// dataType for escaping text (tags) in HTML text nodes
		return content.replace(/</g,'&lt;')
	});

	context.addTransform('code', function (content) {       // dataType for escaping text (tags and entities)in HTML text nodes
		return content.replace(/&/g,'&amp;').replace(/</g,'&lt;')
	});

	context.addTransform('errorString', function (content) {			// dataType for error messages put in HTML output
		reportError(["markit(", workerID, "):", content]);
		return ["<pre><mark style='color:blue'>\n*** Error *** ", markit('code', content), "\n</mark></pre>"].join('');
		//ES6:  `<pre><mark style='color:blue'>\n*** Error *** ${markit('text', content)}\n</mark></pre>`
	});


	/*
	 *  3. Global function : markit(transform, content, parms)
	 *  returns html string
	 *  throws Error if no transform function defined or if transform doesn't return a string or if transform throws Error
	 */

	function markit(transform, content, parms) {
		var html = null  		//; console.log('markit:',transform, content, parms)
		if (transform) {
			var translator = context.transform(transform);     //; console.log(transform,"=",translator)
			if (translator)
				try {
					html = translator.call(null, content, parms);	  	// Note: exceptions not caught inside markit()
				} catch (err) {
					throw new Error([" in transform ", transform, ": ", err.message].join(''))// Note: exceptions rethrown.
				}
			//if ((html) && (typeof html !== 'string')) { // Expecting an HTML fragment
			if (typeof html !== 'string') { // Expecting an HTML fragment
				throw new Error(
					[" bad result from transform ", transform, " => ", JSON.stringify(html)].join());
				//`bad result from transform ${transform} => ${JSON.stringify(html)}`);
			}
		} else {
			throw new Error(
				[" transform ", transform, " not defined."].join());
			//`bad result from transform ${transform} => ${JSON.stringify(html)}`);
		}
		return html
	} // markit(transform, content, parms)


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
		"labeldef	:~ (%word)%ws= (?:%ws(%tag))? (?:%ws(%word)(%block)?)? \\s* :: label(def,label,tag,transform,parmString) ",
		"fundef		:~ (%word)\\s+:{2}(%block) 		:: func(_,name,func) ",
		"gramdef    :~ (%word)\\s+:%block 			:: gram(rules,rule) ",
		"uses		:~ @import\\s+(%block)    		:: uses(_,urls) ",
		"js			:~ @javascript\\s+(%block)    	:: js(_,js) ",
		"css		:~ @css\\s+(%block)    			:: css(_,css) ",
		"blank		:~ [ \\t]* %nl					:: (_) => {return []} ",
		"comment	:~ // %line %nl?            	:: (function (_) {return []}) ",
		"undefined	:~ ([ \\t]* [^\\n\\r]+)     	:: undefined(_,statement) ",
		"tag		:~ [<][^>]*[>]",
		"block		:~ %line %insetline* ",
		"insetline	:~ (?: [ \\t]* %nl | (%ws %line)) ",
		"word		:~ \\S+ ",
		"line		:~ [^\\n\\r]* ",
		"ws			:~ [ \\t]+ ",
		"nl			:~ (?:\\r \\n? | \\n)"
	);

	metaword.label = function (definition, label, tagInfo, transformName, parms) {
		// label(def,label,tag,transform,parmString)
		// construct label definition: { tag:tagString, transform:transformName, parmString:parms}
		var tag = ((tagInfo) ? tagInfo.trim().replace(/\s+/g, " ") : "");	// replace instances of whitespace with single space
		var etag = ''	// empty end tag for now, will be filled in later if necessary
		var transform = (transformName) ? transformName : null
		var parmString = (parms) ? parms : ''
		// console.log(label,'=       tag:',tag,' transform:',transform,' parmString:',parmString)
		if (tag) {		// begin tag defined
			if (tagInfo.substr(-2) === '/>') {	// closed tag
				if (transform)					// can't have a closed tag with a transform (will never be called)
					return markit('errorString', ["Closed tag cannot be used with transform:\n\t", definition.trim()].join(''));
			} else {							// open tag
				etag = ["</", tag.match(/^<\s*(\S+)[^>]*>$/)[1], ">"].join('')
			}
		}
		if (tag || transform) {
			context.addLabelDef(label, {tag: tag, etag: etag, transform: transform, parmString: parmString})
			return[]
		}
		else
			return markit('errorString', ["Empty label definition:\n\t", definition.trim()].join(''));
	} // metaword.label(definition, label, tag, transformName, parms)

	metaword.func = function (_, name, func) {
		var html = [];
		try {
			var geval = eval	// global eval
			var transform = geval(func)
			if (typeof transform === 'function') {
				context.addTransform(name, transform)
			}
			else
				throw new Error("`" + func.trim() + "` is not a function.")
		} catch (err) {		// compile errors on new types
			html = markit('errorString', ["Invalid transform ", name, ": ",err.message].join(''))
		}
		return html
	}; // metaword.func(_, name, func)

	metaword.gram = function (rules, rule) {
		var html = [];
		try {
			var gram = new Grit(rules);		//; console.log(gram)
			compileGrammar(gram);
			context.addTransform(rule, function(content, parmString) {
				if (parmString)
					console.log("Warning: rule " + rule + " - transform parameters `" + parmString + "` will be ignored." )
				return gram.parse(content, parmString)
			})
		} catch (err) {		// compile errors on new types
			html = markit('errorString', err.message)
		}
		return html
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
		return ['<script type=application/javascript>', js, '</script>']
	}; // metaword.js = function (_, js)

	metaword.css = function (_, css) {
		return ['<style scoped>', css, '</style>']
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
			returnValue = ["<style scoped>", content, "</style>"]
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
		var html;
		try {       // all exceptions turned into errorString's
			html = metaword.flatten(metaword.parse(content)).join('')
		} catch (err) {
			html = markit('errorString', err.message)
		}
		return html
	} // function metamarkAdd(content)

	/*********** Everything below this line is predefined markup and could be re-located. **********/
	/*********** See "Dependancy:" comments for API requirements.                         **********/


	/*
	 *  6. Utility function to translate labeled content: toHTMLstring(label, content)
	 *      If no transform for label, use 'myword'
	 *  returns html string or null(no transform found for label)
	 *  throws errors from markit(transform, content))
	 */

	var toHTMLstring = function (label, content) {	//TODO: rename this function, e.g., applyLabel(), when HTML removed
		//**** Dependancy: context
		var htmlResult = null;   // default for no label definition
		var labelDef = context.labelDef(label);					// {tag: tag, etag: etag, transform: transform, parmString: parmString}
		// console.log("label=",label,"labelDef=",labelDef)
		if (labelDef) {
			//; console.log(label,'::',labelDef,'\n',content)
			if (labelDef.tag.substr(-2) === '/>') {// closed tag implies no content
				htmlResult = labelDef.tag;
				if (content) console.log("Closed tag " + labelDef.tag + "used with non-null content.")
			} else {
				var html
				if (context.transform(labelDef.transform)) {
					html = markit(labelDef.transform, content, labelDef.parmString.trim())	// transform defined, apply it
				} else {
					if (labelDef.transform) { // if transform name present but not defined
						if (content) {	//if non-empty content, it's an error
							throw new Error(["Undefined transform: ", labelDef.transform, " for label: ", label].join(''))
						} else { // content must be empty, then apply 'myword' to join of content, parms = transform + parmString
							html = markit('myword', (labelDef.transform + labelDef.parmString).trim())
						}
					} else {  // null transform, hence no parmString
						// if content, apply myword to content, else apply text to the label (strip trailing '()' )
						html = (content) ? markit('myword', content, '') : markit('text', label.replace(/\(\)$/, ''), '')
					}
				}
				//if (html != null)
				htmlResult = [labelDef.tag, html, labelDef.etag].join('');	// wrap result
				//ES6:    `${labelDef.tag}${((html != null) ? html : content)}${endTag(labelDef.tag)}`
			}
		}
		return htmlResult
	}; // toHTMLstring(label, content)


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
		return this.flatten(elems);
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
		if (labelDef && labelDef.transform === 'metamark') { // block of definitons...
			return { report: metamarkAdd(content) };    // report errors
		}
		return { label:label, content:content };
	};

	compileGrammar(myword); // verify grammar, or throw an error

	var mywordParse = function(content) {
		var out = [];
		if (!content) return '';

		context = context.push();	// new context for myword blks

		context.blks = myword.parse(content);

		while (context.blks.length>0) {
			var blk = context.blks[0];

			if (blk.label) try {
				var html = (blk.label === '\t')?  markit('insetblock', blk.content)
					: toHTMLstring(blk.label, blk.content) // prose default, myword blocks must be explicit
				if (html) {
					out.push(html)
				} else { // undefined label or prose
					out.push("<dl><pre><dt><mark>"+markit('text',blk.label)+"</mark></dt><dd>"+
						markit('text',blk.content)+"</dd></pre></dl>")
				}
			} catch (err) {
				out.push(markit('errorString', err.message))
			}

			if (blk.line) { // line of prose...
				var proseContent = blk.line	// TODO: collect in array?
				proseContent += '\n';				// TODO: is this the best way to add newlines back?
				context.blks.shift();   // consume block
				while (context.blks.length>0) { // collect lines in para..
					blk = context.blks[0];   // examine next block
					if (!blk.line) break;
					proseContent += blk.line;
					proseContent += '\n';
					context.blks.shift();   // consume block
				}
				try {
					out.push(markit('prose', proseContent))
				} catch (err) {
					out.push(markit('errorString', err.message))
				}
				continue;
			}

			if (blk.blank) {
				out.push(markit('blankline', ''))
			}

			if (blk.report) {
				out.push(blk.report)
			}

			context.blks.shift();   // consume block
		} // while

		if (context.hasDefinitions()) {
			contextList.push(context) // preserve this context and wrap the output
			out.unshift(['<span class=myword data-context=',(contextList.length-1).toString(),'>'])
		} else {
			out.unshift(['<span class=myword>'])
		}
		out.push('</span>')

		context = context.pop();						// restore previous context

		return myword.flatten(out).join('');			// return single string from meta content and joined array
	};

// default type defintions for blocks

	context.addTransform('myword', mywordParse); //  **** Dependancy: context, compileGrammar()

	context.addTransform('blankline', function(_) {	// blank line HTML
		return('<div class=blank><br/></div>')
	})

	context.addTransform('insetblock', function(content) {	// default transform for inset blocks
		return ['<div class=insetblock>', markit('myword',content), '</div>'].join('')
	});

	context.addTransform('metamark', function (content) {return ''});	// meta-content not output

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
	});

	context.addTransform('include', function(content) { // transform for including content in external resources
														//**** Dependancy: I/O utilities
		var out = [];                        //; console.log('@import',content)
		var absurl, url, urlist = content.trim().split(/\s+/);
		for (var u=0; u < urlist.length; u++) {
			url = urlist[u];
			absurl = composeURL(url);	//; console.log('@import ',absurl)
			loadpath.unshift(directory(absurl));			// push new loadpath
			try {
				var fcontent = fileContent(absurl);
				// if there's a label defined for the URL suffix, use its transform, else use 'myword' transform
				var html = toHTMLstring(url.substring(url.lastIndexOf('.')), fcontent)
				if (typeof html === 'string')
					out.push(html);
				else
					out.push(markit('myword', fcontent));  // apply 'myword' if no label defined for suffix
			} catch (err) { // IO or translateData Error
				out.push(markit('errorString', ["Reading '", absurl, "':\n\t", (err.message || err.name)].join('')))
			}
			loadpath.shift();							// pop loadpath
		}
		return out.join('')
	});


	/*
	 *  8. Transform: proseParse(content)
	 *  create and translate inline elements
	 */

	var sigilProse = new Grit(
		"prose       := (space / word / entity / element  / quote / sigil / symb / nota)*  :: prose ",
		"space       :~ \\s+                                         	:: string",
		"word        :~ [a-z0-9]+ \\s+                               	:: string ",
		"entity      :~ [^\\s()\\[\\]]+                              	:: entity ",
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

	sigilProse.entity = function(entity) {
		var key = '('+entity+')';
		if (context.labelDef(key)) return sigilProse.elem(key,'');
		var punct = entity.match(/^(.+)([.,;!?](?:\s|$))/);
		if (!punct) return null; // not an entity
		var key = '('+punct[1]+')';
		if (context.labelDef(key)) return sigilProse.elem(key,'')+punct[2];
		return null; // not an entity
	};

	sigilProse.element = function(label, box) { //}, bag) {  // label[box](bag)
		// if (bag[0]) return sigilProse.doubleBrackets(label, box, bag); // label[]() or []() ...
		var content = this.flatten(box[1]).join('');
		if (!label) {  // (...) or [...]
			var html = sigilProse.symbol(content);
			// console.log('box',content)
			if (!html) return box[0]+markit('myword', content)+box[2];
			return html;
		}
		var key = label+"()"; // inline label() or label[] ...
		if (!context.labelDef(key)) key = label; // accept generic (block) labels
		if (context.labelDef(key)) { // label[content], and key is defined ....
			var html = sigilProse.elem(key,content);
			if (html != null) return html; // all done...
		} else { // undefined label[content] ....
			// if (label.match(/^([`"*_~])/)) return null; // try for a quote instead..
			if (!label.match(/^([a-zA-Z0-9]+|[^a-zA-Z0-9]+)$/)) return null;
		}
		return ["<span style='font-family:monospace'><mark>", markit('text', label), "</mark>",
			markit("text", this.flatten(box).join('')), "</span>"];
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
		if (context.labelDef(key)) return sigilProse.elem(key,'');
		return null; // not a sigil
	};

	sigilProse.symbol = function(symb) {
		// console.log('symb',symb)
		var key = '('+symb+')';
		if (context.labelDef(key)) return sigilProse.elem(key,'');
		return null; // not a symbol markit('text',symb);
	};

	sigilProse.nota = function(x,word,symb,other) { // none of the above...
		if (other) console.log('nota',x,word,symb,other)
		if (symb) x = x.replace('<','&lt;');
		return x;
	};

	sigilProse.elem = function(label, content) {
		var html;
		try {
			html = markit.withLabel(label, content)		// use internal toHTMLstring() if withLabel() removed from API
		} catch (err) {
			html = markit('errorString', err.message)
		}
		return html;
	};

	compileGrammar(sigilProse); // verify grammar, or throw an error

	var proseParse = function(content) {
		return sigilProse.parse(content);
	}; // proseParse(content)

	context.addTransform('prose', proseParse);       // transform for prose,  **** Dependancy: context, compileGrammar()


	/*
	 *  9. export.....
	 */
	markit.withLabel = toHTMLstring;														// TODO: remove as part of purity exercise
	markit.setDefaultLingo = function(lingo) {	// *** This cannot be called from via markit(), directly or indirectly
		// Note: This check is a little fragile as it depends on the format of the stack trace.
		//       If it encounters an unknown format, it will permit the operation.
		//       Function.caller cannot be used to build a call stack if recursion occurs
		try {Error.stackTraceLimit = Infinity} catch (err) {}		// Required for Chrome (at least)
		var stackTrace = '\n' + new Error().stack		 //;	console.log(stackTrace)
		return ((stackTrace.indexOf('\nmarkit@') === -1) && (stackTrace.indexOf('at markit ') === -1))
						?	metamarkAdd(lingo)
						: markit('errorString','setDefaultLingo() cannot be used by a transform.')
	}

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
