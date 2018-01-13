@doc
 Render Graphviz dot language to svg - uses <https://github.com/mdaines/viz.js>.
	Defines type 'gv' (Graphviz file suffix) for use in notations or typed blocks, e.g.,
	demoS
		.gv
			digraph G { A -> B -> C; A -> C; }

@import viz-lite.js

.gv .. <- gv
gv     :: (dotgraph) => Viz(dotgraph)

@doc
	`Viz()` takes a second options argument options of the form `{format:outformat, engine:layoutapp}`.
	
	`outformat` should always be `'svg'`, `engine`s are one of `dot circo osage twopi`; default is `dot`.
	Note: `dot` is the only engine that works on examples I've tried.

	Some other examples of `dot`:

	eg
		graph { 
		  a -- b
		  a -- b
		  b -- a [color=blue]
		} 

		digraph html {
			abc [shape=none, margin=0, label=<
			<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
			<TR><TD ROWSPAN="3"><FONT COLOR="red">hello</FONT><BR/>world</TD>
			<TD COLSPAN="3">b</TD>
			<TD ROWSPAN="3" BGCOLOR="lightgrey">g</TD>
			<TD ROWSPAN="3">h</TD>
			</TR>
			<TR><TD>c</TD>
			<TD PORT="here">d</TD>
			<TD>e</TD>
			</TR>
			<TR><TD COLSPAN="3">f</TD>
			</TR>
			</TABLE>>];
			}

		digraph g {
		node [shape = record,height=.1];
		node0[label = "<f0> |<f1> G|<f2> "];
		node1[label = "<f0> |<f1> E|<f2> "];
		node2[label = "<f0> |<f1> B|<f2> "];
		node3[label = "<f0> |<f1> F|<f2> "];
		node4[label = "<f0> |<f1> R|<f2> "];
		node5[label = "<f0> |<f1> H|<f2> "];
		node6[label = "<f0> |<f1> Y|<f2> "];
		node7[label = "<f0> |<f1> A|<f2> "];
		node8[label = "<f0> |<f1> C|<f2> "];
		"node0":f2 -> "node4":f1;
		"node0":f0 -> "node1":f1;
		"node1":f0 -> "node2":f1;
		"node1":f2 -> "node3":f1;
		"node2":f2 -> "node8":f1;
		"node2":f0 -> "node7":f1;
		"node4":f2 -> "node6":f1;
		"node4":f0 -> "node5":f1;
		}

		digraph structs {
		node [shape=record];
		struct1 [shape=record,label="<f0> left|<f1> middle|<f2> right"];
		struct2 [shape=record,label="<f0> one|<f1> two"];
		struct3 [shape=record,label="hello\nworld |{ b |{c|<here> d|e}| f}| g | h"];
		struct1:f1 -> struct2:f0;
		struct1:f2 -> struct3:here;
		}

		digraph G {
		subgraph cluster0 {
		node [style=filled,color=white];
		style=filled;
		color=lightgrey;
		a0 -> a1 -> a2 -> a3;
		label = "process #1";
		}
		subgraph cluster1 {
		node [style=filled];
		b0 -> b1 -> b2 -> b3;
		label = "process #2";
		color=blue
		}
		start -> a0;
		start -> b0;
		a1 -> b3;
		b2 -> a3;
		a3 -> a0;
		a3 -> end;
		b3 -> end;
		start [shape=Mdiamond];
		end [shape=Msquare];
		}

		digraph G {
		size="8,6"; ratio=fill; node[fontsize=24];
		ciafan->computefan; fan->increment; computefan->fan; stringdup->fatal;
		main->exit; main->interp_err; main->ciafan; main->fatal; main->malloc;
		main->strcpy; main->getopt; main->init_index; main->strlen; fan->fatal;
		fan->ref; fan->interp_err; ciafan->def; fan->free; computefan->stdprintf;
		computefan->get_sym_fields; fan->exit; fan->malloc; increment->strcmp;
		computefan->malloc; fan->stdsprintf; fan->strlen; computefan->strcmp;
		computefan->realloc; computefan->strlen; debug->sfprintf; debug->strcat;
		stringdup->malloc; fatal->sfprintf; stringdup->strcpy; stringdup->strlen;
		fatal->exit;

		subgraph "cluster_error.h" { label="error.h"; interp_err; }
		subgraph "cluster_sfio.h" { label="sfio.h"; sfprintf; }
		subgraph "cluster_ciafan.c" { label="ciafan.c"; ciafan; computefan;
		increment; }
		subgraph "cluster_util.c" { label="util.c"; stringdup; fatal; debug; }
		subgraph "cluster_query.h" { label="query.h"; ref; def; }
		subgraph "cluster_field.h" { get_sym_fields; }
		subgraph "cluster_stdio.h" { label="stdio.h"; stdprintf; stdsprintf; }
		subgraph "cluster_<libc.a>" { getopt; }
		subgraph "cluster_stdlib.h" { label="stdlib.h"; exit; malloc; free; realloc; }
		subgraph "cluster_main.c" { main; }
		subgraph "cluster_index.h" { init_index; }
		subgraph "cluster_string.h" { label="string.h"; strcpy; strlen; strcmp; strcat; }
		}