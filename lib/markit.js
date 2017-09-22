// -- markit: framework module for publishing MyWord markup ----

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
	 *  0. I/O support: {
	 *        setLoadPath(filepath)         :: String -> undefined
	 *        processURL(url, process)      :: String -> Function -> String
	 *     }
	 */

	const io = function () {
		var loadpath = [''];               	// base for relative URLs, acts like a stack
		
		function directory(url) {
			return url.substring(0, url.lastIndexOf('/') + 1)
		} // directory(url)

		function composeURL(url) {      // only called from processURL
			return /^\/|:\/\//.test(url)  // starts with '/' or contains '://'
				? url                 // partial or absolute URL
				: loadpath[0] + url	// relative URL
		} // composeURL(path)

		function fileContent(url) { // returns content or throws exception, only called from processURL
			var status = 0;
			if (typeof XMLHttpRequest != 'undefined') {
				var request = new XMLHttpRequest();
				request.open("GET", url, false);   //synchronous IO, requires Worker mode in browsers
				request.setRequestHeader("Accept","text/*,*/*")
				request.onerror = function () {
					status = 404
				};
				request.send();
				status = ((status == 0) ? request.status : status );
				if ((status === 200 || status === 0)) {
					return request.responseText
				} else {
					throw new Error(["HTTP status=", status].join(''));
					//ES6: throw new Error(`Reading '${url}' status=${status}`)
				}
			} else {	// try Nodejs file system
				return fs.readFileSync(url, "utf8");
			}
		} // fileContent(url)
		
		function processURL(url, process) {
			var out, absurl = composeURL(url.trim());
			loadpath.unshift(directory(absurl))      // push new loadpath
			try {
				out = process(fileContent(absurl))
			} catch (err) {
				out = markit('errorString', ["Reading '", absurl, "':\n\t", (err.message || err.name)].join(''))
			}
			loadpath.shift()                        // pop loadpath
			return out
		} // processURL(url, process)
		
		function setLoadPath(filepath) {
			loadpath = [directory(filepath)]
		} // setLoadPath(filepath)

		return {
			processURL: processURL,
			setLoadPath: setLoadPath
		}
		
	}()	// const io
	
	Object.freeze(io)			// freeze io


	/*
	 *  1. Init environment - load Grit and if executing as a Worker, setup message handler
	 *  	Note, due to syncIO, file ops only work in Worker mode
	 */

	const workerMode = function() {
		try {
			return (self instanceof WorkerGlobalScope)  // true if functioning as a Worker
		} catch (err) {
			return false
		}
	} ()
	
	const workerID = (workerMode) ? Date.now() : '';   // a given Worker instance or ''
	
	const Grit = function(worker) {                    // a reference to Grit
		if (worker) {
			try {
				// Note extension code must insert _extensionHref in WorkerGlobalSpace if different from location.href
				io.setLoadPath((typeof _extensionHref === 'undefined') ? location.href : _extensionHref)
				io.processURL("grit.js", function(content){
					const geval = eval;
					geval(content);	// eval() in global scope, independent of module scheme
					return ''
				})
			} catch (err) {
				throw new Error(["loading grit.js: ", err.message].join(''))
			}
			return self.Grit;
		} else { // assumes Node.js, or something eslae that supports 'require'
			try {
				require('fs');	// TODO is there a better place for this?load fs for io
				return require("./grit.js");  // Load Grit - grit.js assumed to be co-located
			} catch (err) {
				throw new Error(
					["Unsupported platform - upgrade browser or use CommonJS module system: ", err.message].join('')
				)
			}
		}
	} (workerMode);

	if (workerMode) {  // When used in Worker mode, set global onmessage handler
		onmessage = function (msg) {
			// msg.data[0]:#id, msg.data[1]:type, msg.data[2]:content, msg.data[3]:contextID, msg.data[4]:base url,
			io.setLoadPath(msg.data[ 4 ])
			core.useContext(msg.data[ 3 ])
			postMessage([ msg.data[ 0 ],
				(msg.data[ 1 ] === 'metamark')
					? markit.setDefaultLingo(msg.data[ 2 ])
					: markit(msg.data[ 1 ], msg.data[ 2 ])   // see markit() for spec
			])
		} // onmessage(msg)
	}
	
	if (console) console.log("Worker:" + workerID);

	/*
	 *  2. Module utility functions
	 */

	// nullCheck(value, defunc) : if value is not null return it else return evaluation of default function
	function nullCheck(value, defunc) {  // :: * -> Function -> *
		return (value === null) ? defunc() : value
	} // nullCheck(value, defunc)
	
	// compileGrammar(grammar): utility to compile a Grit grammar and throw an Error if errors reprorted
	function compileGrammar(grammar) {  // :: String -> undefined
		var errors = grammar._compile();
		if (errors.length > 0) {
			errors.unshift(grammar._rules[0].name + " compile failed:");
			throw new Error(errors.join('\n\t'))
		}
	}	// compileGrammar(grammar)


	/*
	 *  3. core object containing framework API : {
	 *        markit:           function(type, content, parms)  :: String -> String -> String -> String
	 *        applyLabel:       function(label, content)        :: String -> String -> String
	 *        applyMetaLabel:   function(label, lingo)          :: String -> String -> String
	 *        contextID:        function()                      :: _ -> String
	 *        useContext:       function(contextID)             :: String -> undefined
	 *        addBaseType:      function(type, transform)       :: String -> Function -> undefined
	 *        setDefaultLingo:  function(lingo)                 :: String -> String
	 *        addImportHandler: function(fileType, handler)     :: String -> Function -> undefined
	 *     }
	 */

	const core = function() {

		/*
		 *  Context class for managing defs
		 */

		const Ctx = function (parent) {
			this.parent = parent;  // link to parent context, null if root
			this.index = {};       // label to dataType map
			this.types = {};       // dataType to transform map
			this.closed = 0;       // 0: can be written, >0: can't be written
			                       //    support for lazy context push - can't add if closed >0
		}; // new Ctx(parent)

		Ctx.prototype = {};
		
		// add new label definition : (success returns the label definition; duplicates return null and are ignored)
		Ctx.prototype.addLabelDef = function (label, labelDef) {
			const labelKey = label.replace(/\s+/g, ' ') // for key matching, white space is equivalent to a single space
			if (this.index[labelKey]) return null       // duplicate definition
			this.index[labelKey] = labelDef
			return labelDef
		}; // Ctx.addLabelDef(label, dataType)

		// lookup label definition associated with a label
		Ctx.prototype.labelDef = function (label) {
			const ldef = this.index[label.replace(/\s+/g, ' ')];  // for key matching, white space is equivalent to a single space
			return (typeof ldef === 'undefined')
				? ((this.parent) ? this.parent.labelDef(label) : null)
				: ((ldef==='') ? null : ldef)  // empty string signifies an (temporarily) undefined label
		}; // Ctx.labelDef(label)

		// add new type definition (success returns the type definition; duplicates return null and are ignored)
		Ctx.prototype.addTransform = function (type, transform) {
			if (this.types[type]) return null  // duplicate definition
			this.types[type] = transform
			return transform
		}; // Ctx.addTransform(type, transform)

		// lookup a transform associated with type
		Ctx.prototype.transform = function (type) {
			return type ? (this.types[type] || (this.parent ? this.parent.transform(type) : null)) : null
		}; // Ctx.transform(type)

		// for context management in markit()
		Ctx.prototype.closeContext = function () {
			this.closed ++          // close for new defintions
			return this             // return current context
		} // Ctx.closeContext()
				
		// for context management in markit()
		Ctx.prototype.reopenContext = function () {
			// if open pop it for new current, then decrement close count return it
			var reopened = (this.closed === 0) ? this.pop() : this
			reopened.closed --
			return reopened
		} // Ctx.reopenContext()

		// primitive op - create a new (nested) context
		Ctx.prototype.push = function () {
			return new Ctx(this)
		}; // Ctx.push(blks)

		// primitive op - return parent context
		Ctx.prototype.pop = function () {
			return this.parent
		}; // Ctx.pop()

				
		Object.freeze(Ctx)
		
		var context = new Ctx(null);  // Create empty root context
		
		/*
		 *  Wrapper functions for adding definitions. Lazy push a new context if current context closed.
		 *  Hides context from metamark
		 */
		function addTransform(type, transform) {
			if (context.closed > 0) context = context.push()
			return context.addTransform(type, transform)
		} // addTransform(type, transform)

		function addLabelDef(label, labelDef) {
			if (context.closed > 0) context = context.push()
			return context.addLabelDef(label, labelDef)
		} // addLabelDef(label, labelDef)

		// Basic error formatting type required for internal use but exported for general use.
		addTransform('errorString', function (content) {  // type defintion for error messages
			if (console) console.error(["markit(", workerID, "):", content].join(''));
			return ["\n*** Error *** ", content, "\n"].join('')
		});
		
		/*
		 *  Global API function : markit(type, content, parms)
		 *  returns the string result of calling the transform - may be an errorString
		 */

		const markit = function(type, content, parms) {
			var output
			if (type) {
				const transform = context.transform(type);
				if (transform) {
					context.closeContext()  // close the current context
					try {
						output = transform.call(null, content, parms);
						output = (typeof output === 'string')  // Expecting a string result
							? output
							: markit('errorString', [" bad result from transform for type ", type, " => ", JSON.stringify(output)].join(''))
					} catch (err) {
						output = markit('errorString', [" in transform for type '", type, "':\n\t", err.message ].join(''))
					}
					context = context.reopenContext()  // restore context, if necessary
				} else output = markit('errorString', [" transform for type '", type, "' not defined."].join(''))
			} else output = markit('errorString', [" illegal type '", JSON.stringify(type), "'"].join(''))
			return output
		} // markit(type, content, parms)


		/*
		 *  'metamark' parser for label and type defintions
		 */

		const metaword = new Grit(
			// Note: this order is important because labeldef could match func/gram containing %ws<-%ws
			"metaword   := (blank / fundef / gramdef / labeldef / uses / js / css / doc / comment / undefined)* ",
			"blank      :~ [ \\t]* %nl                :: (_) => [] ",
			"fundef     :~ (%name)\\s+:{2}(%block)    :: func(_,type,func) ",
			"gramdef    :~ (%name)\\s+:%block         :: gram(rules,rule) ",
			"labeldef   :~ (%word %line) %ws<- (?:%defsep(%tag))? (?:%defsep(%block))? %nl? :: label(def,label,tag,transform) ",
			//"labeldef   :~ (%word(?: (?! %EQ) %ws %word)*) %EQ (?:%defsep(%tag))? (?:%defsep(%block))? %nl? ",
			//"                                         :: label(def,label,tag,transform) ",
			//"EQ         :~ %ws <- (?= %defsep (?: <[a-zA-Z] | &[#a-zA-Z0-9] | [a-zA-Z])) ",
			"defsep     :~ (?:%ws?%nl)?%ws ",
			"uses       :~ @import\\s+(%block)        :: uses(_,urls) ",
			"js         :~ @javascript\\s+(%block)    :: js(_,js) ",
			"css        :~ @css\\s+(%block)           :: css(_,css) ",
			"doc        :~ @doc\\s+(%block)           :: doc(_,doc) ",
			"comment    :~ // %line %nl?              :: (_) => [] ",
			"undefined  :~ [ \\t]* [^\\n\\r]+         :: undefined(statement) ",
			"tag        :~ (?: [<](?:[^>\\n\\r]|(?:%nl\\s))*[>]) | (?:&[#a-zA-Z0-9]*;) ",
			"block      :~ %line %insetline* ",
			"insetline  :~ (?: [ \\t]* %nl | (%ws %line)) ",
			"word       :~ \\S+ ",
			"name       :~ [a-zA-Z]\\w* ",
			"line       :~ [^\\n\\r]* ",
			"ws         :~ [ \\t]+ ",
			"nl         :~ (?:\\r \\n? | \\n) "
		);

		metaword.label = function (definition, label, tagInfo, typeInfo) {
			// label(def,label,tag,transform)
			// construct label definition: { tag:tagString, etag:endTag, type:typeName, parmString:parms}
			const tag = ((tagInfo) ? tagInfo.trim().replace(/\s+/g, " ") : "");  // replace instances of whitespace with single space
			const etag = (tag && (tag[0]==='<') && (tag.substr(-2) !== '/>'))
				? ["</", tag.match(/^<\s*(\S+)[^>]*>$/)[1], ">"].join('')
				: ''
			const transform = (typeInfo) ? typeInfo.trim() : ''
			// empty label defintions are empty strings signifying undefined
			// used to undefine a label that was defined in a parent context.
			// Duplicate labels (null returned from addLabelDef) flagged as errors
			// If no transform string, 'myword' is default type, parmstring = ''
			const tSpec = /^(\S+)([\s\S]*)/.exec(transform) || ['', 'myword', '']  // [0]=src,[1]=type,[2]=parmstring
			return (addLabelDef(label.trim(),
				(tag || transform)
					? {	tag: tag, etag: etag,
							type: tSpec[1],
							transform: function(c) {return markit(tSpec[1], c, tSpec[2].trim())}
						}
					: ''
			) !== null)
				? []
				: markit('errorString',
					["Duplicate definition for '", label, "' ignored.\n\t", definition.trim()].join('')
					)
		} // metaword.label(definition, label, tagInfo, typeInfo)

		metaword.func = function (_, type, func) {
			try {
				const geval = eval	// global eval
				const transform = geval(func)
				return (typeof transform === 'function')
					? ((addTransform(type, transform))
						? []
						: markit('errorString',
							["Duplicate definition for '",type,"' ignored.\n\t", func.trim() ].join('')
							)
						)
					: markit('errorString',
						["Invalid transform for '", type, "', ", func.trim(), " is not a function."].join(''))
			} catch (err) {  // compile errors on new types
				return markit('errorString', err.message)
			}
		}; // metaword.func(_, type, func)

		metaword.gram = function (rules, rule) {
			try {
				const gram = new Grit(rules);
				compileGrammar(gram);
				return addTransform(rule, function(content, parmString) {
					// if (parmString)
					// 	console.log("Warning: rule " + rule + " - transform parameters `" + parmString + "` will be ignored." )
					return gram.parse(content, parmString)
				})
					? []
					: markit('errorString',
						["Duplicate definition for '", rule,"' ignored.\n\t", rules.split('\n')[0]].join(''))
			} catch (err) {		// compile errors on new types
				return markit('errorString', err.message)
			}
		}; // metaword.gram(rules, rule)
		
		metaword.uses = function (_, urls) {
			return urls.trim().split(/\s+/).map(function(url) {
				const fileSuffix = url.substring(url.lastIndexOf('.'))
				const importHandler = importHandlers[fileSuffix]
				return (importHandler)
					? io.processURL(url, importHandler)
					: markit('errorString', ["Importing '", url, "', unsupported file type: ", fileSuffix].join(''))
			}).join('')
		}; // metaword.uses(_, urls)

		metaword.js = function (_, js) {
			return markit('metajs', js)
		}; // metaword.js = function (_, js)

		metaword.css = function (_, css) {
			return markit('metacss', css)
		}; // metaword.css = function (_, css)

		metaword.doc = function (_, doc) {
			return markit('metadoc', '\t' + doc)  // produce an inset block with @doc content
		}; // metaword.doc = function (_, doc)

		metaword.undefined = function (statement) {
			return markit('errorString', ["Unrecognized metaword statement:\n\t", statement].join(''));
			//ES6:                        `Unrecognized metaword statement: ${statement}`)
		}; // metaword.undefined(_, statement)

		compileGrammar(metaword);  // errors will cause initialization to fail

		function metamarkAdd(content) {
			try {       // all exceptions turned into errorString's
				return metaword.flatten(metaword.parse(content)).join('')
			} catch (err) {
				return markit('errorString', err.message)
			}
		} // function metamarkAdd(content)

		function metamarkHandler(url) {  // TODO obsolete
			return io.processURL(url, function(content){ return metamarkAdd(content) })
		} // function metamarkHandler(url)

		const importHandlers = {
			'.mmk': metamarkAdd,
			'.txt': metamarkAdd,
			'.js' : function(content) {
				const geval = eval;
				geval(content);  // eval() in global scope, independent of module scheme
				return ''
			},
			'.css': function(content) {
				return markit('metacss', content)
			}
		}

		// Default types for JS, CSS and doc - return error (override in default lingo for desired semantics)
		addTransform('metajs', function (content) {
			return markit('errorString', ['No handler for @javascript: ', content.substring(0,79), ' ...'].join(''))
		});

		addTransform('metacss', function (content) {
			return markit('errorString', ['No handler for @css: ', content.substring(0,79), ' ...'].join(''))
		});
		
		addTransform('metadoc', function (content) { return '' });  // @doc: no-op by default
		
		var contextList = [context]  // Initialize list of persistent, immutable contexts for dynamic updates

		/*
		 *  Utility function to prohibit calls if called from markit().
		 *	Note: This check is a little fragile as it depends on the format of the stack trace.
		 *       If it encounters an unknown format, it will permit the operation.
		 *       Function.caller cannot be used to build a call stack if recursion occurs
		 */
		function checksafe(name, operation) {  // :: String -> Function -> Any
			try {Error.stackTraceLimit = Infinity} catch (err) {}  // Required for Chrome (at least)
			const stackTrace = '\n' + new Error().stack
			return ((stackTrace.indexOf('\nmarkit@') === -1) && (stackTrace.indexOf('at markit ') === -1))
				? operation()
				: markit('errorString', name + ' cannot be used by a transform.')
		} // function checksafe(name, operation)

		return { // core API for internal use in module 'markit'
			// Global API function
			markit: function(type, content, parms) {
				return (arguments.length===1) // 'curry' the function if only one argument
					? function(content, parms) { return markit(type, content, parms) }
					: markit(type, content, parms)
			}, // markit(type, content, parms)
			// Global API for users of label defintions
			applyLabel: function () {  // wrapper function to contain recursionStack
				var recursionStack = []  // used to detect infinite loops in lingos
				return function (label, content) {
					// return null if label undefined, else returns '' if content null, else apply labelDef
					const labelDef = context.labelDef(label.trim())
					if (labelDef === null)
						return null
					else if (content === null)
						return ''
					else {
						var output
						const marker = [label, content].join('\t')  // marker contains type and content
						if (recursionStack.indexOf(marker) >= 0) {  // if marker already on stack, there's a loop
							output = markit('errorString', [" Lingo bug, infinite loop applying label '", label, "' to: ", content].join(''))
						} else {
							recursionStack.push(marker)  // add call to recursionStack
							output = [labelDef.tag, labelDef.transform(content), labelDef.etag].join('')
							recursionStack.pop()
						}
						return output
					}
				}
			} (), // => applyLabel(label, content)
				// 'myword'-only API for processing and scoping meta-content
			applyMetaLabel: function(label, lingo) {
				const labelDef = context.labelDef(label.trim());
				return (labelDef && labelDef.type === 'metamark')
					? metamarkAdd(lingo)  // block of definitons...
					: ''                  // no meta-content
			}, // applyMetaLabel(label, lingo)
			contextID: function () {
				if (context.closed === 0) {  // calculate a conditional contextID if context open (new definitions)
					contextList.push(context)  // persistant context for dynamic updates
					return (contextList.length-1).toString()
				} else
					return ''
			}, // contextID()
			// Internal module API to support dynamic content, initialization of base types and (re)setting the default lingo.
			useContext: function (contextID) {  // *** This cannot be called from via markit(), directly or indirectly
				checksafe("useContext()", function (){
					context = contextList[parseInt(contextID)]  // see if contextID can be used as index to persistant list
					if (context == undefined) context = contextList[0]
				})
			}, // useContext(contextID)
			addBaseType: addTransform,          // *** This can only be called during module initialization.
			setDefaultLingo: function(lingo) {  // *** This cannot be called from via markit(), directly or indirectly
				return checksafe('setDefaultLingo()', function () {
					while (context.parent !== null) context.pop()  // discard all but base context
					context.closeContext()      // make sure base context is closed
					context = context.push()    // push a new context for the default lingo
					contextList = [context]     // reset contextList with the default lingo
					return metamarkAdd(lingo)   // add the default lingo
				})
			}, // setDefaultLingo(lingo)
			addImportHandler: function (fileType, handler) {
				importHandlers[fileType] = handler
			} // addImportHandler(fileType, handler)
		}
	} ()	// const core
	
	const markit = core.markit          // copy to module level for internal convenience
	const applyLabel = core.applyLabel  // copy to module level for internal convenience
	
	/*
	 * Common utility for making various label patterns
	 */
	
	const BLOCK=0, SPAN=1, SYM=2, ESC=3  // four patterns

	function makePat(pat, start, end) {  // :: Integer -> String -> String -> String
		switch (pat) {
			case BLOCK: return [start, ' ..'].join('')
			case SPAN:  return [start, ' .. ', end].join('')
			case SYM:   return start
			case ESC:   return [start, ' .'].join('')
			default:    return ''
		} // switch
	} // makePat(pat, start, end)

	/*
	 *  4. Transform: myword
	 *  create and translate block elements
	 */

	const myword = new Grit(
		"myword  := (blank / block / line)*         :: elems ",
		"block   := label (gap* inset line)+        :: block ",
		"line    :~ [^\\n\\r]* %nl?                 :: (s)=>({btype:'line', content:s}) ",
		"label   :~ (\\S*)                          :: (s)=>s ",
		"inset   :~ [ ]{2,8}|[ ]?\\t                :: (s)=>s ",
		"blank   :~ [ \\t]* %nl                     :: (s)=>({btype:'blank', content:s}) ",
		"gap     :~ ([ ]? %nl)                      :: (s)=>s ",
		"nl      :~ (?: \\n | \\r\\n?)              :: ()=>'' "
	);

	myword.elems = function(elems) {
		return elems.map(function(elem) {return elem[0]});  // flatten and discard any 'nl' empty strings
	};

	const GAP=0, INSET=1, LINE=2, MINin=2, MAXin=8;

	myword.block = function(label, lines) {
		label = label || "\t"; // empty label, \t calls insetblock transform
		var min = MAXin+1, tab = false; // min space inset....
		var i	// loop variable
		for (i=0; i<lines.length; i+=1) {
			if (i==0 && lines[i][GAP].length == 0) continue; // first line content
			var n = lines[i][INSET].length
			if (lines[i][LINE].length == 0) continue; // blank line
			if (n==1) tab = true
			else if (n>MAXin) min = MAXin
			else if (n<min) min = n;
		}
		if (tab && min<=MAXin) // mixed tab and space indents: report myword syntax error...
			//return { btype:'bad', content:label+this.flatten(lines).map(x=>(x.content||x)).join('')}
			return { 
				btype:'bad',
				content:label+this.flatten(lines).map(x => typeof x.content === 'string' ? x.content : x).join('')
			}
		content = '';
		for (i=0; i<lines.length; i+=1) {
			var ln = lines[i]; // ln = [gap inset line]
			var gap = ln[GAP];   // ["\n", ...]
			for (var j=0; j<ln[0].length; j+=1) { // gap lines...
				if (i==0 && j==0) continue; // skip first line gap nl
				content += gap[j];
			}
			var pad = ln[INSET].length-min
			if (pad>0) content += '         '.slice(0,pad)
			content += ln[LINE].content
		}
		return { btype:'block', content:content, label:label, meta:core.applyMetaLabel(makePat(BLOCK, label), content)}
	};

	compileGrammar(myword); // verify grammar, or throw an error(fail initialization)

	core.addBaseType('myword', function() {
		const blkFuncs = {
			block: function(block) {
				return (block.label === '\t')
					? markit('insetblock', block.content)
					: nullCheck(applyLabel(makePat(BLOCK, block.label), block.content), function () {
						return markit('markedblock', block.content, block.label)
						}) + block.meta  // add any content from metamark
			}, // block:
			line: function(block, blocks, pureProse) {  // Note: side effect on blocks
				var proseContent = [block.content]
				while (blocks.length>0) {             // collect lines
					var blk = blocks.shift()            // get next block
					if (blk.btype === 'line') {         // is it a line?
						proseContent.push(blk.content);   // Yes, add line to content
					} else {
						blocks.unshift(blk); break;       // No, put it back and exit??
					}
				} // while
				// if pureProse, gnenerate prose output, else make it a paragraph
				return markit(pureProse ? 'prose' : 'paragraph', proseContent.join(''))
			}, // line:
			blank: function(block) {
				return markit('blankline', block.content)
			}, // blank:
			bad: function(block) {
				return markit('errorString',
					//'Bad indent, mix of tab and spaces..\n' + markit('text', block.content.replace(/ /g,'·').replace(/\t/g,'⟶'))
					'Bad indent, mix of tab and spaces..\n' + block.content.replace(/ /g,'·').replace(/\t/g,'⟶')
				)
			}  // bad:
		} // blkFuncs

		return function(content) {   // 'myword' transform
			if (!content) return '';
			var out = [];              // output accumulator (too bad array.map() can't be used)
			var blocks = myword.parse(content);
			var pureProse = blocks.every(function(blk) { return blk.btype === 'line' })  // pureProse = true if all lines
			while (blocks.length>0) {  // process blocks array until nothing left
				out.push(blkFuncs[blocks[0].btype](blocks.shift(), blocks, pureProse))
			} // while
			// Wrap a myword scope around the generated output and return it
			return markit('scope', myword.flatten(out).join(''), core.contextID())
		} // 'myword' transform
	}())  // addBaseType('myword', ...

	core.addImportHandler('.myw', function(content) {
		if (!content) return '';
		var out = [];              // output accumulator (too bad array.map() can't be used)
		var blocks = myword.parse(content);
		while (blocks.length>0) {  // process blocks array until nothing left
			if (blocks[0].btype === 'block')
				out.push(blocks[0].meta)  // just output any meta-content
			blocks.shift()
		} // while
		return myword.flatten(out).join('')
	}) // '.myw' import handler

	core.addBaseType('paragraph', function(content) {   // paragraph of prose, default to just prose
		return markit('prose', content)
	})

	core.addBaseType('blankline', function(content) {         // blank line
		return(content)
	})

	core.addBaseType('insetblock', function(content) {  // default transform for inset blocks
		return ['\n', markit('myword',content), '\n'].join('')
		//return ['<div class=insetblock>', markit('myword',content), '</div>'].join('')
	})

	core.addBaseType('markedblock', function (content, label) {  // dataType for blocks with undefined labels
		// reconstruct with marked label
		return ['•',markit('text', label), '•\t', markit('text', content.replace(/\n/g, '\n\t')), '\n'].join('')
	})

	core.addBaseType('scope', function(content) {  // default transform for scope, just throw away contextID
		return content.substring(content.indexOf('\t') + 1)
	})

	core.addBaseType('metamark', function (content) {return ''});   // meta-content not output

	core.addBaseType('text', function (content) {return content});  // 'text' is just literal text

	core.addBaseType('include', function(content) { // transform for including content in external resources
		return content.trim().split(/\s+/).map(function(url) {
			return io.processURL(url, function(content) {
				// if label defined apply it, else assume 'myword' content
				return nullCheck(applyLabel(makePat(BLOCK, url.substring(url.lastIndexOf('.'))), content), function() {
					return markit('myword', content)
				})
			})
		}).join('')
	})


	/*
	 *  5. Transform: proseParse(content)
	 *  create and translate inline elements
	 */

	core.addBaseType('prose', function() {
		const simpleProse = new Grit(
			"prose    := (escape / span / symbol / text / ctl)*   :: (c) => this.flatten(c).join('') ",
			"escape   :~ %symchar{2} [\\S]*                       :: escape ",
			"span     := sstart (nested/(!end content))+ end      :: span ",
			"nested   := nstart (nested/notq)+ end ",
			"notq     := (!nstart !end content)* ",
			"content  := esc / nota ",
			"sstart   :~ %tag                                     :: s_begin ",
			"nstart   :~ %tag                                     :: n_begin ",
			"end      :~ %tag                                     :: end_ ",
			"esc      :~ %tag                                     :: escape_ ",
			"symbol   :~ %symchar [\\S]*                          :: symbol ",
			"text     :~ %symchar | [a-zA-Z0-9 ]+                 :: (c) => markit('text', c) ",
			"nota     :~ [a-zA-Z0-9 ]+ | [\\s\\S]                 :: (x) => x ",
			"ctl      :~ (\\r\\n?) | [\\s\\S]                     :: ctl ",
			"tag      :~ [^a-zA-Z0-9\\s\\u0080-\\uffff]+ ",
			"symchar  :~ [^a-zA-Z0-9\\x00-\\x20] "
		);

		simpleProse.escape = function(symbol) {             // escape	:~ %symchar{2} [\\S]*
			return (applyLabel(makePat(ESC, symbol[0]), null) === null)
				? null               // not escape character, fail
				: _try(symbol, this)

			function _try(symbol, parser) {
				if (symbol.length < 2)
					return null  // nothing to escape
				const tag = symbol.substr(1)
				// escape begin tag, symbol, or escape character
				if ((applyLabel(makePat(SPAN, tag, closer(tag)), null) !== null) ||
					(applyLabel(makePat(SYM, tag), null) !== null) ||
					(tag === symbol[0])) {
					parser.pos = parser.pos - (symbol.length - 2)          // consume 2 characters
					return applyLabel(makePat(ESC, symbol[0]), symbol[1])  // apply escape label defintion
				}
				// else try symbol one character shorter
				parser.pos--
				return _try(symbol.substr(0, symbol.length-1), parser)     // TRO should work
			} // _try(symbol, parser)
		} // simpleProse.escape(symbol)

		var _qmarker	// save span begin and end (in closure)

		simpleProse.span = function(bmark, xs, emark) {     // span := sstart (nested/(!end nota))+ end
			return applyLabel(makePat(SPAN, bmark, emark), this.flatten(xs).join(''))
		} // simpleProse.quote(bmark, xs, emark)

		simpleProse.s_begin = function(mark) {              // sstart :~ %tag
			return _try(mark, closer(mark), this)

			function _try(mark, end_mark, parser) {
				if (applyLabel(makePat(SPAN, mark, end_mark), null) !== null) {
					_qmarker = {begin:mark, end:end_mark}
					return mark
				}
				// if a symbol of same length, fail to symbol rule
				if (applyLabel(makePat(SYM, mark), null) !== null)
					return null
				// else try one character shorter
				if (mark.length === 1)
					return null
				parser.pos--
				return _try(mark.substr(0, mark.length-1), end_mark.substr(1), parser)
			} // _try(mark, parser)
		} // simpleProse.s_begin(mark)

		simpleProse.n_begin = function(mark) {             // nstart :~ %tag
			const parser = this
			const begin_mark = _qmarker.begin
			if (begin_mark === _qmarker.end)  // quotes can't be nested
				return null
			if (mark.substr(0, begin_mark.length) === begin_mark) { // match => success
				parser.pos = parser.pos - (mark.length-begin_mark.length)
				return begin_mark
			} else // no match => fail; (parser.pos = parser.pos - mark.length)
				return null
		} // simpleProse.n_begin(mark)

		simpleProse.end_ = function(mark) {                // end :~ %tag
			return _try(mark, _qmarker.end, this)

			function _try(mark, end_mark, parser) {	// no recursive loop so could be folded back into outer function
				if (mark.substr(0, end_mark.length) === end_mark) {
					parser.pos = parser.pos - (mark.length - end_mark.length)
					return end_mark
				} else  // no match => fail; (parser.pos = parser.pos - mark.length)
					return null
			} // _try(mark, parser)
		} // simpleProse._end(mark)

		simpleProse.escape_ = function(symbol) {           // esc :~ %tag
			// Note: almost identical to simpleProse.escape, just different set of things to escape
			return (applyLabel(makePat(ESC, symbol[0]), null) === null)
				? null               // not escape character, fail
				: _try(symbol, this)

			function _try(symbol, parser) {
				if (symbol.length < 2)
					return null  // nothing to escape
				const tag = symbol.substr(1)
				// escape begin tag, end tag, or escape character
				if ((tag === _qmarker.begin) || (tag === _qmarker.end) || (tag === symbol[0])) {
					parser.pos = parser.pos - (symbol.length - 2)         // consume 2 characters
					return applyLabel(makePat(ESC, symbol[0]), symbol[1]) // apply escape label defintion
				}
				// else try symbol one character shorter
				parser.pos--
				return _try(symbol.substr(0, symbol.length-1), parser)
			} // _try(symbol, parser)
		} // simpleProse.escape_(symbol)

		simpleProse.symbol = function(symbol) {           // symbol :~ %symchar [\\S]*
			return _try(symbol, this)

			function _try(symbol, parser) {
				const result = applyLabel(makePat(SYM, symbol), '')
				if (result !== null)
					return result  // symbol match
				if (symbol.length === 1)
					return null
				// else try symbol one character shorter
				parser.pos--
				return _try(symbol.substr(0, symbol.length-1), parser)
			} // _try(symbol, parser)
		} // simpleProse.symbol(symbol)

		simpleProse.ctl = function(c, cr) {             // ctl :~ (\\r\\n?) | [\\s\\S]
			return markit('ctrl', (cr) ? '\n' : c)      // control codes; all newlines become \n
		}

		const _bracketsMap = {
			'(':')', ')':'(',
			'[':']', ']':'[',
			'<':'>', '>':'<',
			'{':'}', '}':'{'
		}

		function closer(begin) {
			var end = '';
			for (var i = begin.length - 1; i >= 0; i--)
				end += _bracketsMap[begin[i]] || begin[i];
			return end;
		}

		compileGrammar(simpleProse); // verify grammar, or throw an error (fail initialization)

		return function (content) {
			return simpleProse.parse(content)
		} // 'prose' transform

	} ()) // addBaseType('prose', ...

	core.addBaseType('ctrl', function (content) {return content});  // 'ctrl' is just literal text

	/*
	 *  6. export Global API = markit() function with three sub-functions:
	 *      applyLabel:       function(label, content)
	 *      setDefaultLingo:  function(lingo)
	 *      translate:        function(url)
	 */

	core.addBaseType = null  // initialization done, disable any further changes to set to base types.
	Object.freeze(core)      // and freeze core

	markit.applyLabel = core.applyLabel           // export sub-function to apply a label to content
	markit.setDefaultLingo = core.setDefaultLingo // export sub-function for setting default lingo
	markit.translate = function(url) {            // export sub-function for translating contents of absolute url
		io.setLoadPath(url)           // set base for relative url's from parameter (should be absolute)
		core.useContext('0')          // reset context
		return markit('include', url) // return translated contents
	 } // translate(url)

	Object.freeze(markit)  // Global API, freeze it

	if (typeof module !== 'undefined' && typeof exports === 'object') {
		module.exports = markit;
	} else if (typeof define === 'function' && define.amd) {
		define(function () {
			return markit;
		});
	} else
		this.markit = markit;   // global translator markit(trans©mName, content)

}).call(function() {
	return this || (typeof window !== 'undefined' ? window : global);
} ());