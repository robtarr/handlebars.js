module("basic context");

Handlebars.registerHelper('helperMissing', function(helper, context) {
  if(helper === "link_to") {
    return new Handlebars.SafeString("<a>" + context + "</a>");
  }
});

var shouldCompileTo = function(string, hashOrArray, expected, message) {
  shouldCompileToWithPartials(string, hashOrArray, false, expected, message);
};
var shouldCompileToWithPartials = function(string, hashOrArray, partials, expected, message) {
  var template = CompilerContext[partials ? 'compileWithPartial' : 'compile'](string), ary;
  if(Object.prototype.toString.call(hashOrArray) === "[object Array]") {
    helpers = hashOrArray[1];

    if(helpers) {
      for(var prop in Handlebars.helpers) {
        helpers[prop] = Handlebars.helpers[prop];
      }
    }

    ary = [];
    ary.push(hashOrArray[0]);
    ary.push({ helpers: hashOrArray[1], partials: hashOrArray[2] });
  } else {
    ary = [hashOrArray];
  }

  result = template.apply(this, ary);
  equal(result, expected, "'" + expected + "' should === '" + result + "': " + message);
};

var shouldThrow = function(fn, exception, message) {
  var caught = false;
  try {
    fn();
  }
  catch (e) {
    if (e instanceof exception) {
      caught = true;
    }
  }

  ok(caught, message || null);
}


test("compiling with a basic context", function() {
  shouldCompileTo("Goodbye\n{{cruel}}\n{{world}}!", {cruel: "cruel", world: "world"}, "Goodbye\ncruel\nworld!",
                  "It works if all the required keys are provided");
});

test("comments", function() {
  shouldCompileTo("{{! Goodbye}}Goodbye\n{{cruel}}\n{{world}}!",
    {cruel: "cruel", world: "world"}, "Goodbye\ncruel\nworld!",
    "comments are ignored");
});

test("boolean", function() {
  var string   = "{{#goodbye}}GOODBYE {{/goodbye}}cruel {{world}}!";
  shouldCompileTo(string, {goodbye: true, world: "world"}, "GOODBYE cruel world!",
                  "booleans show the contents when true");

  shouldCompileTo(string, {goodbye: false, world: "world"}, "cruel world!",
                  "booleans do not show the contents when false");
});

test("zeros", function() {
	shouldCompileTo("num1: {{num1}}, num2: {{num2}}", {num1: 42, num2: 0},
			"num1: 42, num2: 0");
	shouldCompileTo("num: {{.}}", 0, "num: 0");
	shouldCompileTo("num: {{num1/num2}}", {num1: {num2: 0}}, "num: 0");
});

test("newlines", function() {
    shouldCompileTo("Alan's\nTest", {}, "Alan's\nTest");
    shouldCompileTo("Alan's\rTest", {}, "Alan's\rTest");
});

test("escaping text", function() {
  shouldCompileTo("Awesome's", {}, "Awesome's", "text is escaped so that it doesn't get caught on single quotes");
  shouldCompileTo("Awesome\\", {}, "Awesome\\", "text is escaped so that the closing quote can't be ignored");
  shouldCompileTo("Awesome\\\\ foo", {}, "Awesome\\\\ foo", "text is escaped so that it doesn't mess up backslashes");
  shouldCompileTo("Awesome {{foo}}", {foo: '\\'}, "Awesome \\", "text is escaped so that it doesn't mess up backslashes");
  shouldCompileTo(' " " ', {}, ' " " ', "double quotes never produce invalid javascript");
});

test("escaping expressions", function() {
 shouldCompileTo("{{{awesome}}}", {awesome: "&\"\\<>"}, '&\"\\<>',
        "expressions with 3 handlebars aren't escaped");

 shouldCompileTo("{{&awesome}}", {awesome: "&\"\\<>"}, '&\"\\<>',
        "expressions with {{& handlebars aren't escaped");

 shouldCompileTo("{{awesome}}", {awesome: "&\"'`\\<>"}, '&amp;&quot;&#x27;&#x60;\\&lt;&gt;',
        "by default expressions should be escaped");

});

test("functions returning safestrings shouldn't be escaped", function() {
  var hash = {awesome: function() { return new Handlebars.SafeString("&\"\\<>"); }};
  shouldCompileTo("{{awesome}}", hash, '&\"\\<>',
      "functions returning safestrings aren't escaped");
});

test("functions", function() {
  shouldCompileTo("{{awesome}}", {awesome: function() { return "Awesome"; }}, "Awesome",
                  "functions are called and render their output");
});

test("functions with context argument", function() {
  shouldCompileTo("{{awesome frank}}",
      {awesome: function(context) { return context; },
        frank: "Frank"},
      "Frank", "functions are called with context arguments");
});

test("paths with hyphens", function() {
  shouldCompileTo("{{foo-bar}}", {"foo-bar": "baz"}, "baz", "Paths can contain hyphens (-)");
});

test("nested paths", function() {
  shouldCompileTo("Goodbye {{alan/expression}} world!", {alan: {expression: "beautiful"}},
                  "Goodbye beautiful world!", "Nested paths access nested objects");
});

test("nested paths with empty string value", function() {
  shouldCompileTo("Goodbye {{alan/expression}} world!", {alan: {expression: ""}},
                  "Goodbye  world!", "Nested paths access nested objects with empty string");
});

test("--- TODO --- bad idea nested paths", function() {
  return;
	var hash     = {goodbyes: [{text: "goodbye"}, {text: "Goodbye"}, {text: "GOODBYE"}], world: "world"};
  shouldThrow(function() {
      CompilerContext.compile("{{#goodbyes}}{{../name/../name}}{{/goodbyes}}")(hash);
    }, Handlebars.Exception,
    "Cannot jump (..) into previous context after moving into a context.");

  var string = "{{#goodbyes}}{{.././world}} {{/goodbyes}}";
  shouldCompileTo(string, hash, "world world world ", "Same context (.) is ignored in paths");
});

test("that current context path ({{.}}) doesn't hit helpers", function() {
	shouldCompileTo("test: {{.}}", [null, {helper: "awesome"}], "test: ");
});

test("complex but empty paths", function() {
  shouldCompileTo("{{person/name}}", {person: {name: null}}, "");
  shouldCompileTo("{{person/name}}", {person: {}}, "");
});

test("this keyword in paths", function() {
  var string = "{{#goodbyes}}{{this}}{{/goodbyes}}";
  var hash = {goodbyes: ["goodbye", "Goodbye", "GOODBYE"]};
  shouldCompileTo(string, hash, "goodbyeGoodbyeGOODBYE",
    "This keyword in paths evaluates to current context");

  string = "{{#hellos}}{{this/text}}{{/hellos}}"
  hash = {hellos: [{text: "hello"}, {text: "Hello"}, {text: "HELLO"}]};
  shouldCompileTo(string, hash, "helloHelloHELLO", "This keyword evaluates in more complex paths");
});

module("inverted sections");

test("inverted sections with unset value", function() {
  var string = "{{#goodbyes}}{{this}}{{/goodbyes}}{{^goodbyes}}Right On!{{/goodbyes}}";
  var hash = {};
  shouldCompileTo(string, hash, "Right On!", "Inverted section rendered when value isn't set.");
});

test("inverted section with false value", function() {
  var string = "{{#goodbyes}}{{this}}{{/goodbyes}}{{^goodbyes}}Right On!{{/goodbyes}}";
  var hash = {goodbyes: false};
  shouldCompileTo(string, hash, "Right On!", "Inverted section rendered when value is false.");
});

test("inverted section with empty set", function() {
  var string = "{{#goodbyes}}{{this}}{{/goodbyes}}{{^goodbyes}}Right On!{{/goodbyes}}";
  var hash = {goodbyes: []};
  shouldCompileTo(string, hash, "Right On!", "Inverted section rendered when value is empty set.");
});

module("blocks");

test("array", function() {
  var string   = "{{#goodbyes}}{{text}}! {{/goodbyes}}cruel {{world}}!"
  var hash     = {goodbyes: [{text: "goodbye"}, {text: "Goodbye"}, {text: "GOODBYE"}], world: "world"};
  shouldCompileTo(string, hash, "goodbye! Goodbye! GOODBYE! cruel world!",
                  "Arrays iterate over the contents when not empty");

  shouldCompileTo(string, {goodbyes: [], world: "world"}, "cruel world!",
                  "Arrays ignore the contents when empty");

});

test("empty block", function() {
  var string   = "{{#goodbyes}}{{/goodbyes}}cruel {{world}}!"
  var hash     = {goodbyes: [{text: "goodbye"}, {text: "Goodbye"}, {text: "GOODBYE"}], world: "world"};
  shouldCompileTo(string, hash, "cruel world!",
                  "Arrays iterate over the contents when not empty");

  shouldCompileTo(string, {goodbyes: [], world: "world"}, "cruel world!",
                  "Arrays ignore the contents when empty");
});

test("nested iteration", function() {

});

test("block with complex lookup", function() {
  var string = "{{#goodbyes}}{{text}} cruel {{../name}}! {{/goodbyes}}"
  var hash     = {name: "Alan", goodbyes: [{text: "goodbye"}, {text: "Goodbye"}, {text: "GOODBYE"}]};

  shouldCompileTo(string, hash, "goodbye cruel Alan! Goodbye cruel Alan! GOODBYE cruel Alan! ",
                  "Templates can access variables in contexts up the stack with relative path syntax");
});

test("helper with complex lookup", function() {
  var string = "{{#goodbyes}}{{{link ../prefix}}}{{/goodbyes}}"
  var hash = {prefix: "/root", goodbyes: [{text: "Goodbye", url: "goodbye"}]};
  var helpers = {link: function(prefix) {
    return "<a href='" + prefix + "/" + this.url + "'>" + this.text + "</a>"
  }};
  shouldCompileTo(string, [hash, helpers], "<a href='/root/goodbye'>Goodbye</a>")
});

test("helper block with complex lookup expression", function() {
  var string = "{{#goodbyes}}{{../name}}{{/goodbyes}}"
  var hash = {name: "Alan"};
  var helpers = {goodbyes: function(fn) {
		var out = "";
		var byes = ["Goodbye", "goodbye", "GOODBYE"];
		for (var i = 0,j = byes.length; i < j; i++) {
			out += byes[i] + " " + fn(this) + "! ";
		}
    return out;
  }};
  shouldCompileTo(string, [hash, helpers], "Goodbye Alan! goodbye Alan! GOODBYE Alan! ");
});

test("helper with complex lookup and nested template", function() {
  var string = "{{#goodbyes}}{{#link ../prefix}}{{text}}{{/link}}{{/goodbyes}}";
  var hash = {prefix: '/root', goodbyes: [{text: "Goodbye", url: "goodbye"}]};
  var helpers = {link: function (prefix, fn) {
      return "<a href='" + prefix + "/" + this.url + "'>" + fn(this) + "</a>";
  }};
  shouldCompileToWithPartials(string, [hash, helpers], false, "<a href='/root/goodbye'>Goodbye</a>");
});

test("helper with complex lookup and nested template in VM+Compiler", function() {
  var string = "{{#goodbyes}}{{#link ../prefix}}{{text}}{{/link}}{{/goodbyes}}";
  var hash = {prefix: '/root', goodbyes: [{text: "Goodbye", url: "goodbye"}]};
  var helpers = {link: function (prefix, fn) {
      return "<a href='" + prefix + "/" + this.url + "'>" + fn(this) + "</a>";
  }};
  shouldCompileToWithPartials(string, [hash, helpers], true, "<a href='/root/goodbye'>Goodbye</a>");
});

test("block with deep nested complex lookup", function() {
  var string = "{{#outer}}Goodbye {{#inner}}cruel {{../../omg}}{{/inner}}{{/outer}}";
  var hash = {omg: "OMG!", outer: [{ inner: [{ text: "goodbye" }] }] };

  shouldCompileTo(string, hash, "Goodbye cruel OMG!");
});

test("block helper", function() {
  var string   = "{{#goodbyes}}{{text}}! {{/goodbyes}}cruel {{world}}!";
  var template = CompilerContext.compile(string);

  result = template({goodbyes: function(fn) { return fn({text: "GOODBYE"}); }, world: "world"});
  equal(result, "GOODBYE! cruel world!", "Block helper executed");
});

test("block helper staying in the same context", function() {
  var string   = "{{#form}}<p>{{name}}</p>{{/form}}"
  var template = CompilerContext.compile(string);

  result = template({form: function(fn) { return "<form>" + fn(this) + "</form>" }, name: "Yehuda"});
  equal(result, "<form><p>Yehuda</p></form>", "Block helper executed with current context");
});

test("block helper should have context in this", function() {
  var source = "<ul>{{#people}}<li>{{#link}}{{name}}{{/link}}</li>{{/people}}</ul>";
  var link = function(fn) {
    return '<a href="/people/' + this.id + '">' + fn(this) + '</a>';
  };
  var data = { "people": [
    { "name": "Alan", "id": 1 },
    { "name": "Yehuda", "id": 2 }
  ]};

  shouldCompileTo(source, [data, {link: link}], "<ul><li><a href=\"/people/1\">Alan</a></li><li><a href=\"/people/2\">Yehuda</a></li></ul>");
});

test("block helper for undefined value", function() {
	shouldCompileTo("{{#empty}}shouldn't render{{/empty}}", {}, "");
});

test("block helper passing a new context", function() {
  var string   = "{{#form yehuda}}<p>{{name}}</p>{{/form}}"
  var template = CompilerContext.compile(string);

  result = template({form: function(context, fn) { return "<form>" + fn(context) + "</form>" }, yehuda: {name: "Yehuda"}});
  equal(result, "<form><p>Yehuda</p></form>", "Context variable resolved");
});

test("block helper passing a complex path context", function() {
  var string   = "{{#form yehuda/cat}}<p>{{name}}</p>{{/form}}"
  var template = CompilerContext.compile(string);

  result = template({form: function(context, fn) { return "<form>" + fn(context) + "</form>" }, yehuda: {name: "Yehuda", cat: {name: "Harold"}}});
  equal(result, "<form><p>Harold</p></form>", "Complex path variable resolved");
});

test("nested block helpers", function() {
  var string   = "{{#form yehuda}}<p>{{name}}</p>{{#link}}Hello{{/link}}{{/form}}"
  var template = CompilerContext.compile(string);

  result = template({
    form: function(context, fn) { return "<form>" + fn(context) + "</form>" },
    yehuda: {name: "Yehuda",
             link: function(fn) { return "<a href='" + this.name + "'>" + fn(this) + "</a>"; }
            }
  });
  equal(result, "<form><p>Yehuda</p><a href='Yehuda'>Hello</a></form>", "Both blocks executed");
});

test("block inverted sections", function() {
  shouldCompileTo("{{#people}}{{name}}{{^}}{{none}}{{/people}}", {none: "No people"},
    "No people");
});

test("block inverted sections with empty arrays", function() {
  shouldCompileTo("{{#people}}{{name}}{{^}}{{none}}{{/people}}", {none: "No people", people: []},
    "No people");
});

test("block helper inverted sections", function() {
  var string = "{{#list people}}{{name}}{{^}}<em>Nobody's here</em>{{/list}}"
  var list = function(context, options) {
    if (context.length > 0) {
      var out = "<ul>";
      for(var i = 0,j=context.length; i < j; i++) {
        out += "<li>";
        out += options.fn(context[i]);
        out += "</li>";
      }
      out += "</ul>";
      return out;
    } else {
      return "<p>" + options.inverse(this) + "</p>";
    }
  };

  var hash = {list: list, people: [{name: "Alan"}, {name: "Yehuda"}]};
  var empty = {list: list, people: []};
  var rootMessage = {
    list: function(context, options) { if(context.length === 0) { return "<p>" + options.inverse(this) + "</p>"; } },
    people: [],
    message: "Nobody's here"
  }

  var messageString = "{{#list people}}Hello{{^}}{{message}}{{/list}}";

  // the meaning here may be kind of hard to catch, but list.not is always called,
  // so we should see the output of both
  shouldCompileTo(string, hash, "<ul><li>Alan</li><li>Yehuda</li></ul>", "an inverse wrapper is passed in as a new context");
  shouldCompileTo(string, empty, "<p><em>Nobody's here</em></p>", "an inverse wrapper can be optionally called");
  shouldCompileTo(messageString, rootMessage, "<p>Nobody&#x27;s here</p>", "the context of an inverse is the parent of the block");
});

module("helpers hash");

test("providing a helpers hash", function() {
  shouldCompileTo("Goodbye {{cruel}} {{world}}!", [{cruel: "cruel"}, {world: "world"}], "Goodbye cruel world!",
                  "helpers hash is available");

  shouldCompileTo("Goodbye {{#iter}}{{cruel}} {{world}}{{/iter}}!", [{iter: [{cruel: "cruel"}]}, {world: "world"}],
                  "Goodbye cruel world!", "helpers hash is available inside other blocks");
});

test("in cases of conflict, the explicit hash wins", function() {

});

test("the helpers hash is available is nested contexts", function() {

});

module("partials");

test("basic partials", function() {
  var string = "Dudes: {{#dudes}}{{> dude}}{{/dudes}}";
  var partial = "{{name}} ({{url}}) ";
  var hash = {dudes: [{name: "Yehuda", url: "http://yehuda"}, {name: "Alan", url: "http://alan"}]};
  shouldCompileToWithPartials(string, [hash, {}, {dude: partial}], true, "Dudes: Yehuda (http://yehuda) Alan (http://alan) ",
                  "Basic partials output based on current context.");
});

test("partials with context", function() {
  var string = "Dudes: {{>dude dudes}}";
  var partial = "{{#this}}{{name}} ({{url}}) {{/this}}";
  var hash = {dudes: [{name: "Yehuda", url: "http://yehuda"}, {name: "Alan", url: "http://alan"}]};
  shouldCompileToWithPartials(string, [hash, {}, {dude: partial}], true, "Dudes: Yehuda (http://yehuda) Alan (http://alan) ",
                  "Partials can be passed a context");
});

test("partial in a partial", function() {
  var string = "Dudes: {{#dudes}}{{>dude}}{{/dudes}}";
  var dude = "{{name}} {{> url}} ";
  var url = "<a href='{{url}}'>{{url}}</a>";
  var hash = {dudes: [{name: "Yehuda", url: "http://yehuda"}, {name: "Alan", url: "http://alan"}]};
  shouldCompileToWithPartials(string, [hash, {}, {dude: dude, url: url}], true, "Dudes: Yehuda <a href='http://yehuda'>http://yehuda</a> Alan <a href='http://alan'>http://alan</a> ", "Partials are rendered inside of other partials");
});

test("rendering undefined partial throws an exception", function() {
  shouldThrow(function() {
      var template = CompilerContext.compile("{{> whatever}}");
      template();
    }, Handlebars.Exception, "Should throw exception");
});

test("rendering template partial in vm mode throws an exception", function() {
  shouldThrow(function() {
      var template = CompilerContext.compile("{{> whatever}}");
       var string = "Dudes: {{>dude}} {{another_dude}}";
       var dude = "{{name}}";
       var hash = {name:"Jeepers", another_dude:"Creepers"};
      template();
    }, Handlebars.Exception, "Should throw exception");
});

test("rendering function partial in vm mode", function() {
  var string = "Dudes: {{#dudes}}{{> dude}}{{/dudes}}";
  var partial = function(context) {
    return context.name + ' (' + context.url + ') ';
  };
  var hash = {dudes: [{name: "Yehuda", url: "http://yehuda"}, {name: "Alan", url: "http://alan"}]};
  shouldCompileTo(string, [hash, {}, {dude: partial}], "Dudes: Yehuda (http://yehuda) Alan (http://alan) ",
                  "Function partials output based in VM.");
});

test("GH-14: a partial preceding a selector", function() {
   var string = "Dudes: {{>dude}} {{another_dude}}";
   var dude = "{{name}}";
   var hash = {name:"Jeepers", another_dude:"Creepers"};
   shouldCompileToWithPartials(string, [hash, {}, {dude:dude}], true, "Dudes: Jeepers Creepers", "Regular selectors can follow a partial");
});

module("String literal parameters");

test("simple literals work", function() {
  var string   = 'Message: {{hello "world" 12 true false}}';
  var hash     = {};
  var helpers  = {hello: function(param, times, bool1, bool2) {
    if(typeof times !== 'number') { times = "NaN"; }
    if(typeof bool1 !== 'boolean') { bool1 = "NaB"; }
    if(typeof bool2 !== 'boolean') { bool2 = "NaB"; }
    return "Hello " + param + " " + times + " times: " + bool1 + " " + bool2;
  }}
  shouldCompileTo(string, [hash, helpers], "Message: Hello world 12 times: true false", "template with a simple String literal");
});

test("using a quote in the middle of a parameter raises an error", function() {
  shouldThrow(function() {
    var string   = 'Message: {{hello wo"rld"}}';
    CompilerContext.compile(string);
  }, Error, "should throw exception");
});

test("escaping a String is possible", function(){
  var string   = 'Message: {{{hello "\\"world\\""}}}';
  var hash     = {}
  var helpers = {hello: function(param) { return "Hello " + param; }}
  shouldCompileTo(string, [hash, helpers], "Message: Hello \"world\"", "template with an escaped String literal");
});

test("it works with ' marks", function() {
  var string   = 'Message: {{{hello "Alan\'s world"}}}';
  var hash     = {}
  var helpers = {hello: function(param) { return "Hello " + param; }}
  shouldCompileTo(string, [hash, helpers], "Message: Hello Alan's world", "template with a ' mark");
});

module("multiple parameters");

test("simple multi-params work", function() {
  var string   = 'Message: {{goodbye cruel world}}';
  var hash     = {cruel: "cruel", world: "world"}
  var helpers = {goodbye: function(cruel, world) { return "Goodbye " + cruel + " " + world; }}
  shouldCompileTo(string, [hash, helpers], "Message: Goodbye cruel world", "regular helpers with multiple params");
});

test("block multi-params work", function() {
  var string   = 'Message: {{#goodbye cruel world}}{{greeting}} {{adj}} {{noun}}{{/goodbye}}';
  var hash     = {cruel: "cruel", world: "world"}
  var helpers = {goodbye: function(cruel, world, fn) {
    return fn({greeting: "Goodbye", adj: cruel, noun: world});
  }}
  shouldCompileTo(string, [hash, helpers], "Message: Goodbye cruel world", "block helpers with multiple params");
})

module("safestring");

test("constructing a safestring from a string and checking its type", function() {
  var safe = new Handlebars.SafeString("testing 1, 2, 3");
  ok(safe instanceof Handlebars.SafeString, "SafeString is an instance of Handlebars.SafeString");
  equal(safe, "testing 1, 2, 3", "SafeString is equivalent to its underlying string");
});

module("helperMissing");

test("if a context is not found, helperMissing is used", function() {
  var string = "{{hello}} {{link_to world}}"
  var context = { hello: "Hello", world: "world" };

  shouldCompileTo(string, context, "Hello <a>world</a>")
});

module("knownHelpers");

test("Known helper should render helper", function() {
  var template = CompilerContext.compile("{{hello}}", {knownHelpers: {"hello" : true}})

  var result = template({}, {helpers: {hello: function() { return "foo"; }}});
  equal(result, "foo", "'foo' should === '" + result);
});

test("Unknown helper in knownHelpers only mode should be passed as undefined", function() {
  var template = CompilerContext.compile("{{typeof hello}}", {knownHelpers: {'typeof': true}, knownHelpersOnly: true})

  var result = template({}, {helpers: {'typeof': function(arg) { return typeof arg; }, hello: function() { return "foo"; }}});
  equal(result, "undefined", "'undefined' should === '" + result);
});
test("Builtin helpers available in knownHelpers only mode", function() {
  var template = CompilerContext.compile("{{#unless foo}}bar{{/unless}}", {knownHelpersOnly: true})

  var result = template({});
  equal(result, "bar", "'bar' should === '" + result);
});
test("Field lookup works in knownHelpers only mode", function() {
  var template = CompilerContext.compile("{{foo}}", {knownHelpersOnly: true})

  var result = template({foo: 'bar'});
  equal(result, "bar", "'bar' should === '" + result);
});
test("Conditional blocks work in knownHelpers only mode", function() {
  var template = CompilerContext.compile("{{#foo}}bar{{/foo}}", {knownHelpersOnly: true})

  var result = template({foo: 'baz'});
  equal(result, "bar", "'bar' should === '" + result);
});
test("Invert blocks work in knownHelpers only mode", function() {
  var template = CompilerContext.compile("{{^foo}}bar{{/foo}}", {knownHelpersOnly: true})

  var result = template({foo: false});
  equal(result, "bar", "'bar' should === '" + result);
});

module("built-in helpers");

test("with", function() {
  var string = "{{#with person}}{{first}} {{last}}{{/with}}";
  shouldCompileTo(string, {person: {first: "Alan", last: "Johnson"}}, "Alan Johnson");
});

test("if", function() {
  var string   = "{{#if goodbye}}GOODBYE {{/if}}cruel {{world}}!";
  shouldCompileTo(string, {goodbye: true, world: "world"}, "GOODBYE cruel world!",
                  "if with boolean argument shows the contents when true");
  shouldCompileTo(string, {goodbye: "dummy", world: "world"}, "GOODBYE cruel world!",
                  "if with string argument shows the contents");
  shouldCompileTo(string, {goodbye: false, world: "world"}, "cruel world!",
                  "if with boolean argument does not show the contents when false");
  shouldCompileTo(string, {world: "world"}, "cruel world!",
                  "if with undefined does not show the contents");
  shouldCompileTo(string, {goodbye: ['foo'], world: "world"}, "GOODBYE cruel world!",
                  "if with non-empty array shows the contents");
  shouldCompileTo(string, {goodbye: [], world: "world"}, "cruel world!",
                  "if with empty array does not show the contents");
});

test("each", function() {
  var string   = "{{#each goodbyes}}{{text}}! {{/each}}cruel {{world}}!"
  var hash     = {goodbyes: [{text: "goodbye"}, {text: "Goodbye"}, {text: "GOODBYE"}], world: "world"};
  shouldCompileTo(string, hash, "goodbye! Goodbye! GOODBYE! cruel world!",
                  "each with array argument iterates over the contents when not empty");
  shouldCompileTo(string, {goodbyes: [], world: "world"}, "cruel world!",
                  "each with array argument ignores the contents when empty");
});

test("overriding property lookup", function() {

});


test("passing in data to a compiled function that expects data - works with helpers", function() {
  var template = CompilerContext.compile("{{hello}}", {data: true});

  var helpers = {
    hello: function(options) {
      return options.data.adjective + " "  + this.noun;
    }
  };

  var result = template({noun: "cat"}, {helpers: helpers, data: {adjective: "happy"}});
  equals("happy cat", result, "Data output by helper");
});

test("passing in data to a compiled function that expects data - works with helpers and parameters", function() {
  var template = CompilerContext.compile("{{hello world}}", {data: true});

  var helpers = {
    hello: function(noun, options) {
      return options.data.adjective + " "  + noun + (this.exclaim ? "!" : "");
    }
  };

  var result = template({exclaim: true, world: "world"}, {helpers: helpers, data: {adjective: "happy"}});
  equals("happy world!", result, "Data output by helper");
});

test("passing in data to a compiled function that expects data - works with block helpers", function() {
  var template = CompilerContext.compile("{{#hello}}{{world}}{{/hello}}", {data: true});

  var helpers = {
    hello: function(fn) {
      return fn(this);
    },
    world: function(options) {
      return options.data.adjective + " world" + (this.exclaim ? "!" : "");
    }
  };

  var result = template({exclaim: true}, {helpers: helpers, data: {adjective: "happy"}});
  equals("happy world!", result, "Data output by helper");
});

test("passing in data to a compiled function that expects data - works with block helpers that use ..", function() {
  var template = CompilerContext.compile("{{#hello}}{{world ../zomg}}{{/hello}}", {data: true});

  var helpers = {
    hello: function(fn) {
      return fn({exclaim: "?"});
    },
    world: function(thing, options) {
      return options.data.adjective + " " + thing + (this.exclaim || "");
    }
  };

  var result = template({exclaim: true, zomg: "world"}, {helpers: helpers, data: {adjective: "happy"}});
  equals("happy world?", result, "Data output by helper");
});

test("passing in data to a compiled function that expects data - data is passed to with block helpers where children use ..", function() {
  var template = CompilerContext.compile("{{#hello}}{{world ../zomg}}{{/hello}}", {data: true});

  var helpers = {
    hello: function(fn, inverse) {
      return fn.data.accessData + " " + fn({exclaim: "?"});
    },
    world: function(thing, options) {
      return options.data.adjective + " " + thing + (this.exclaim || "");
    }
  };

  var result = template({exclaim: true, zomg: "world"}, {helpers: helpers, data: {adjective: "happy", accessData: "#win"}});
  equals("#win happy world?", result, "Data output by helper");
});

test("you can override inherited data when invoking a helper", function() {
  var template = CompilerContext.compile("{{#hello}}{{world zomg}}{{/hello}}", {data: true});

  var helpers = {
    hello: function(fn) {
      return fn({exclaim: "?", zomg: "world"}, { data: {adjective: "sad"} });
    },
    world: function(thing, options) {
      return options.data.adjective + " " + thing + (this.exclaim || "");
    }
  };

  var result = template({exclaim: true, zomg: "planet"}, {helpers: helpers, data: {adjective: "happy"}});
  equals("sad world?", result, "Overriden data output by helper");
});


test("you can override inherited data when invoking a helper with depth", function() {
  var template = CompilerContext.compile("{{#hello}}{{world ../zomg}}{{/hello}}", {data: true});

  var helpers = {
    hello: function(fn) {
      return fn({exclaim: "?"}, { data: {adjective: "sad"} });
    },
    world: function(thing, options) {
      return options.data.adjective + " " + thing + (this.exclaim || "");
    }
  };

  var result = template({exclaim: true, zomg: "world"}, {helpers: helpers, data: {adjective: "happy"}});
  equals("sad world?", result, "Overriden data output by helper");
});

test("helpers take precedence over same-named context properties", function() {
  var template = CompilerContext.compile("{{goodbye}} {{cruel world}}");

  var helpers = {
    goodbye: function() {
      return this.goodbye.toUpperCase();
    }
  };

  var context = {
    cruel: function(world) {
      return "cruel " + world.toUpperCase();
    },

    goodbye: "goodbye",
    world: "world"
  };

  var result = template(context, {helpers: helpers});
  equals(result, "GOODBYE cruel WORLD", "Helper executed");
});

test("helpers take precedence over same-named context properties", function() {
  var template = CompilerContext.compile("{{#goodbye}} {{cruel world}}{{/goodbye}}");

  var helpers = {
    goodbye: function(fn) {
      return this.goodbye.toUpperCase() + fn(this);
    }
  };

  var context = {
    cruel: function(world) {
      return "cruel " + world.toUpperCase();
    },

    goodbye: "goodbye",
    world: "world"
  };

  var result = template(context, {helpers: helpers});
  equals(result, "GOODBYE cruel WORLD", "Helper executed");
});

test("Scoped names take precedence over helpers", function() {
  var template = CompilerContext.compile("{{this.goodbye}} {{cruel world}} {{cruel this.goodbye}}");

  var helpers = {
    goodbye: function() {
      return this.goodbye.toUpperCase();
    }
  };

  var context = {
    cruel: function(world) {
      return "cruel " + world.toUpperCase();
    },

    goodbye: "goodbye",
    world: "world"
  };

  var result = template(context, {helpers: helpers});
  equals(result, "goodbye cruel WORLD cruel GOODBYE", "Helper not executed");
});

test("Scoped names take precedence over block helpers", function() {
  var template = CompilerContext.compile("{{#goodbye}} {{cruel world}}{{/goodbye}} {{this.goodbye}}");

  var helpers = {
    goodbye: function(fn) {
      return this.goodbye.toUpperCase() + fn(this);
    }
  };

  var context = {
    cruel: function(world) {
      return "cruel " + world.toUpperCase();
    },

    goodbye: "goodbye",
    world: "world"
  };

  var result = template(context, {helpers: helpers});
  equals(result, "GOODBYE cruel WORLD goodbye", "Helper executed");
});

test("helpers can take an optional hash", function() {
  var template = CompilerContext.compile('{{goodbye cruel="CRUEL" world="WORLD" times=12}}');

  var helpers = {
    goodbye: function(options) {
      return "GOODBYE " + options.hash.cruel + " " + options.hash.world + " " + options.hash.times + " TIMES";
    }
  };

  var context = {};

  var result = template(context, {helpers: helpers});
  equals(result, "GOODBYE CRUEL WORLD 12 TIMES", "Helper output hash");
});

test("helpers can take an optional hash with booleans", function() {
  var helpers = {
    goodbye: function(options) {
      if (options.hash.print === true) {
        return "GOODBYE " + options.hash.cruel + " " + options.hash.world;
      } else if (options.hash.print === false) {
        return "NOT PRINTING";
      } else {
        return "THIS SHOULD NOT HAPPEN";
      }
    }
  };

  var context = {};

  var template = CompilerContext.compile('{{goodbye cruel="CRUEL" world="WORLD" print=true}}');
  var result = template(context, {helpers: helpers});
  equals(result, "GOODBYE CRUEL WORLD", "Helper output hash");

  var template = CompilerContext.compile('{{goodbye cruel="CRUEL" world="WORLD" print=false}}');
  var result = template(context, {helpers: helpers});
  equals(result, "NOT PRINTING", "Boolean helper parameter honored");
});

test("block helpers can take an optional hash", function() {
  var template = CompilerContext.compile('{{#goodbye cruel="CRUEL" times=12}}world{{/goodbye}}');

  var helpers = {
    goodbye: function(options) {
      return "GOODBYE " + options.hash.cruel + " " + options.fn(this) + " " + options.hash.times + " TIMES";
    }
  };

  var result = template({}, {helpers: helpers});
  equals(result, "GOODBYE CRUEL world 12 TIMES", "Hash parameters output");
});

test("block helpers can take an optional hash with booleans", function() {
  var helpers = {
    goodbye: function(options) {
      if (options.hash.print === true) {
        return "GOODBYE " + options.hash.cruel + " " + options.fn(this);
      } else if (options.hash.print === false) {
        return "NOT PRINTING";
      } else {
        return "THIS SHOULD NOT HAPPEN";
      }
    }
  };

  var template = CompilerContext.compile('{{#goodbye cruel="CRUEL" print=true}}world{{/goodbye}}');
  var result = template({}, {helpers: helpers});
  equals(result, "GOODBYE CRUEL world", "Boolean hash parameter honored");

  var template = CompilerContext.compile('{{#goodbye cruel="CRUEL" print=false}}world{{/goodbye}}');
  var result = template({}, {helpers: helpers});
  equals(result, "NOT PRINTING", "Boolean hash parameter honored");
});


test("arguments to helpers can be retrieved from options hash in string form", function() {
  var template = CompilerContext.compile('{{wycats is.a slave.driver}}', {stringParams: true});

  var helpers = {
    wycats: function(passiveVoice, noun, options) {
      return "HELP ME MY BOSS " + passiveVoice + ' ' + noun;
    }
  };

  var result = template({}, {helpers: helpers});

  equals(result, "HELP ME MY BOSS is.a slave.driver", "String parameters output");
});

test("when using block form, arguments to helpers can be retrieved from options hash in string form", function() {
  var template = CompilerContext.compile('{{#wycats is.a slave.driver}}help :({{/wycats}}', {stringParams: true});

  var helpers = {
    wycats: function(passiveVoice, noun, options) {
      return "HELP ME MY BOSS " + passiveVoice + ' ' +
              noun + ': ' + options.fn(this);
    }
  };

  var result = template({}, {helpers: helpers});

  equals(result, "HELP ME MY BOSS is.a slave.driver: help :(", "String parameters output");
});

test("when inside a block in String mode, .. passes the appropriate context in the options hash", function() {
  var template = CompilerContext.compile('{{#with dale}}{{tomdale ../need dad.joke}}{{/with}}', {stringParams: true});

  var helpers = {
    tomdale: function(desire, noun, options) {
      return "STOP ME FROM READING HACKER NEWS I " +
              options.contexts[0][desire] + " " + noun;
    },

    "with": function(context, options) {
      return options.fn(options.contexts[0][context]);
    }
  };

  var result = template({
    dale: {},

    need: 'need-a'
  }, {helpers: helpers});

  equals(result, "STOP ME FROM READING HACKER NEWS I need-a dad.joke", "Proper context variable output");
});

test("when inside a block in String mode, .. passes the appropriate context in the options hash to a block helper", function() {
  var template = CompilerContext.compile('{{#with dale}}{{#tomdale ../need dad.joke}}wot{{/tomdale}}{{/with}}', {stringParams: true});

  var helpers = {
    tomdale: function(desire, noun, options) {
      return "STOP ME FROM READING HACKER NEWS I " +
              options.contexts[0][desire] + " " + noun + " " +
              options.fn(this);
    },

    "with": function(context, options) {
      return options.fn(options.contexts[0][context]);
    }
  };

  var result = template({
    dale: {},

    need: 'need-a'
  }, {helpers: helpers});

  equals(result, "STOP ME FROM READING HACKER NEWS I need-a dad.joke wot", "Proper context variable output");
});

