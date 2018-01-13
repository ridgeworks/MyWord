@doc .myw
	####  Package `critic.mmk`
	[CriticMarkup] defines a set of notations that authors and editors can use to track changes to plain text documents. This package defines those notations for use in MyWord documents:
	.tsv
		Operation		Notation		Style Selector
		Insertion		`{++ .. ++}`	ins.critic.insert
		Deletion		`{-- .. --}`	del.critic.delete
		Substitution	`{~~ .. ~~}`	N.A.
		Comment			`{>> .. <<}`	span.critic.comment
		Highlight		`{== .. ==}`	mark.critic.highlight

	Default syle rules set background colors. The default type of the content is `prose` so CriticMarkup cannot be applied at the block level, i.e., across paragraphs.
	
	An example:
	demo
		Don’t go around saying{-- to people that--} the world owes you a living. The world owes you nothing. It was here first.
		
		{~~One~>Only one~~} thing is impossible for God: To find {++any++} sense in any copyright law on the planet.
		
		{==Truth is stranger than fiction==}{>>true<<}, but it is because Fiction is obliged to stick to possibilities; Truth isn’t.

	&
		[CriticMarkup] <- link http://criticmarkup.com

// Notations:
{++ .. ++} <- <ins class="critic insert">
{-- .. --} <- <del class="critic delete">
{~~ .. ~~} <- criticSubstitution
{>> .. <<} <- <span class="critic comment">
{== .. ==} <- <mark class="critic highlight">

// Type for substitution text - if not substitution syntax, treat as 'myword' in {~~ ~~}:
criticSubstitution :~ ([\S\s]*)~>([\S\s]*) | [\S\s]* :: (all, del, ins) => 
							(del != null)
								? `<del class="critic delete">${markit('prose', del)}</del><ins class="critic insert">${markit('prose', ins)}</ins>`
								: `{~~${markit('prose', all)}~~}`
								
// Finally some default CSS - just sets some background colours.
@css
	ins.critic.insert {background:lightgreen}
	del.critic.delete {background:lightsalmon}
	span.critic.comment {background:lightcyan}
	mark.critic.highlight {background:lavender}