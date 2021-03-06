require.config({
  paths: {
    bootstrap: './vendor/bootstrap.min',
    diffMatchPatch: './vendor/diff_match_patch.min',
    handlebars: './vendor/handlebars.min',
    handlebarsExtended: './utils/handlebars_helper',
    jquery: './vendor/jquery.min',
    locales: './locales/locale',
    lodash: './vendor/lodash.min',
    pathToRegexp: './vendor/path-to-regexp/index',
    prettify: './vendor/prettify/prettify',
    utilsSampleRequest: './utils/send_sample_request',
    ripples: './vendor/bootstrap-material-design/dist/js/ripples',
    materialDesign: './vendor/bootstrap-material-design/dist/js/material'
  },
  shim: {
    bootstrap: {
      deps: ['jquery']
    },
    diffMatchPatch: {
      exports: 'diff_match_patch'
    },
    handlebars: {
      exports: 'Handlebars'
    },
    handlebarsExtended: {
      deps: ['jquery', 'handlebars'],
      exports: 'Handlebars'
    },
    prettify: {
      exports: 'prettyPrint'
    },
    ripples: {
      deps: ['jquery']
    },
    materialDesign: {
      deps: ['jquery']
    },
  },
  urlArgs: 'v=' + (new Date()).getTime(),
  waitSeconds: 15
});

require([
  'jquery',
  'lodash',
  'locales',
  'handlebarsExtended',
  './api_project.js',
  './api_data.js',
  'prettify',
  'utilsSampleRequest',
  'bootstrap',
  'pathToRegexp',
  'ripples',
  'materialDesign'
], function ($, _, locale, Handlebars, apiProject, apiData, prettyPrint, sampleRequest) {

  // load google web fonts
  loadGoogleFontCss();

  var api = apiData.api;

  //
  // Templates
  //
  var templateHeader = Handlebars.compile($('#template-header').html());
  var templateFooter = Handlebars.compile($('#template-footer').html());
  var templateArticle = Handlebars.compile($('#template-article').html());
  var templateCompareArticle = Handlebars.compile($('#template-compare-article').html());
  var templateGenerator = Handlebars.compile($('#template-generator').html());
  var templateProject = Handlebars.compile($('#template-project').html());
  var templateSections = Handlebars.compile($('#template-sections').html());
  var templateSidenav = Handlebars.compile($('#template-sidenav').html());

  //
  // apiProject defaults
  //
  if (!apiProject.template)
    apiProject.template = {};

  if (apiProject.template.withCompare == null)
    apiProject.template.withCompare = true;

  if (apiProject.template.withGenerator == null)
    apiProject.template.withGenerator = true;

  if (apiProject.template.forceLanguage)
    locale.setLanguage(apiProject.template.forceLanguage);

  // Setup jQuery Ajax
  $.ajaxSetup(apiProject.template.jQueryAjaxSetup);

  //
  // Data transform
  //
  // grouped by group
  var apiByGroup = _.groupBy(api, function (entry) {
    return entry.group;
  });

  // grouped by group and name
  var apiByGroupAndName = {};
  $.each(apiByGroup, function (index, entries) {
    apiByGroupAndName[index] = _.groupBy(entries, function (entry) {
      return entry.name;
    });
  });

  //
  // sort api within a group by title ASC and custom order
  //
  var newList = [];
  var umlauts = { 'ä': 'ae', 'ü': 'ue', 'ö': 'oe', 'ß': 'ss' }; // TODO: remove in version 1.0
  $.each(apiByGroupAndName, function (index, groupEntries) {
    // get titles from the first entry of group[].name[] (name has versioning)
    var titles = [];
    $.each(groupEntries, function (titleName, entries) {
      var title = entries[0].title;
      if (title !== undefined) {
        title.toLowerCase().replace(/[äöüß]/g, function ($0) { return umlauts[$0]; });
        titles.push(title + '#~#' + titleName); // '#~#' keep reference to titleName after sorting
      }
    });
    // sort by name ASC
    titles.sort();

    // custom order
    if (apiProject.order)
      titles = sortByOrder(titles, apiProject.order, '#~#');

    // add single elements to the new list
    titles.forEach(function (name) {
      var values = name.split('#~#');
      var key = values[1];
      groupEntries[key].forEach(function (entry) {
        newList.push(entry);
      });
    });
  });
  // api overwrite with ordered list
  api = newList;

  //
  // Group- and Versionlists
  //
  var apiGroups = {};
  var apiGroupTitles = {};
  var apiVersions = {};
  apiVersions[apiProject.version] = 1;

  $.each(api, function (index, entry) {
    apiGroups[entry.group] = 1;
    apiGroupTitles[entry.group] = entry.groupTitle || entry.group;
    apiVersions[entry.version] = 1;
  });

  // sort groups
  apiGroups = Object.keys(apiGroups);
  apiGroups.sort();

  // custom order
  if (apiProject.order)
    apiGroups = sortByOrder(apiGroups, apiProject.order);

  // sort versions DESC
  apiVersions = Object.keys(apiVersions);
  apiVersions.sort();
  apiVersions.reverse();

  //
  // create Navigationlist
  //
  var nav = [];
  apiGroups.forEach(function (group) {
    var subNav = [];
    // Submenu
    var oldName = '';
    api.forEach(function (entry) {
      if (entry.group === group) {
        switch (entry.type.toLowerCase()) {
          case 'post':
            label = 'info';
            break;
          case 'get':
            label = "success";
            break;
          case 'put':
            label = 'warning';
            break;
          case 'delete' || 'del':
            label = 'danger';
            break;
          default:
            label = 'default';
        }
        if (oldName !== entry.name) {
          subNav.push({
            title: entry.title,
            group: group,
            name: entry.name,
            type: entry.type,
            version: entry.version,
            label: label
          });
        } else {
          subNav.push({
            title: entry.title,
            group: group,
            hidden: true,
            name: entry.name,
            type: entry.type,
            version: entry.version,
            label: label
          });
        }
        oldName = entry.name;
      }
    });
    // Mainmenu entry
    nav.push({
      group: group,
      isHeader: true,
      title: apiGroupTitles[group],
      subNav: subNav
    });
    subNav = [];
  });
  function add_nav(nav, content, index) {
    if (!content) return;
    var topics = content.match(/<h2>(.+?)<\/h2>/gi);
    topics.forEach(function (entry) {
      var title = entry.replace(/<.+?>/g, '');    // Remove all HTML tags for the title
      var entry_tags = entry.match(/id="(?:api-)?([^\-]+)-(.+)"/);    // Find the group and name in the id property
      var name = (entry_tags ? entry_tags[2] : null);
      if (title && name) {
        nav.splice(index, 0, {
          group: '_',
          name: name,
          //isHeader: false,
          title: title,
          //  isFixed: false,
        });
        index++;
      }
    });
  }

  // Mainmenu Header entry
  if (apiProject.header) {
    nav.unshift({
      group: '_',
      isHeader: true,
      title: (apiProject.header.title == null) ? locale.__('General') : apiProject.header.title,
      //  isFixed: true
    });
    add_nav(nav, apiProject.header.content, 1);
  }

  // Mainmenu Footer entry
  if (apiProject.footer && apiProject.footer.title != null) {
    nav.push({
      group: '_footer',
      isHeader: true,
      title: apiProject.footer.title,
      isFixed: true
    });
  }

  // render pagetitle
  var title = apiProject.title ? apiProject.title : 'apiDoc: ' + apiProject.name + ' - ' + apiProject.version;
  $(document).attr('title', title);

  // remove loader
  $('#loader').remove();

  // render sidenav
  var fields = {
    nav: nav
  };
  $('#sidenav').append(templateSidenav(fields));

  // render Generator
  $('#generator').append(templateGenerator(apiProject));

  // render Project
  _.extend(apiProject, { versions: apiVersions });
  $('#project').append(templateProject(apiProject));

  // render apiDoc, header/footer documentation
  if (apiProject.header)
    $('#header').append(templateHeader(apiProject.header));

  if (apiProject.footer)
    $('#footer').append(templateFooter(apiProject.footer));

  //
  // Render Sections and Articles
  //
  var articleVersions = {};
  var content = '';
  apiGroups.forEach(function (groupEntry) {
    var articles = [];
    var oldName = '';
    var fields = {};
    var title = groupEntry;
    var description = '';
    articleVersions[groupEntry] = {};

    // render all articles of a group
    api.forEach(function (entry) {
      if (groupEntry === entry.group) {
        if (oldName !== entry.name) {
          // determine versions
          api.forEach(function (versionEntry) {
            if (groupEntry === versionEntry.group && entry.name === versionEntry.name) {
              if (!articleVersions[entry.group][entry.name])
                articleVersions[entry.group][entry.name] = [];

              articleVersions[entry.group][entry.name].push(versionEntry.version);
            }
          });
          fields = {
            article: entry,
            versions: articleVersions[entry.group][entry.name]
          };
        } else {
          fields = {
            article: entry,
            hidden: true,
            versions: articleVersions[entry.group][entry.name]
          };
        }

        // add prefix URL for endpoint
        if (apiProject.url)
          fields.article.url = apiProject.url + fields.article.url;

        addArticleSettings(fields, entry);

        if (entry.groupTitle)
          title = entry.groupTitle;

        // TODO: make groupDescription compareable with older versions (not important for the moment)
        if (entry.groupDescription)
          description = entry.groupDescription;

        articles.push({
          article: templateArticle(fields),
          group: entry.group,
          name: entry.name
        });
        oldName = entry.name;
      }
    });

    // render Section with Articles
    var fields = {
      group: groupEntry,
      title: title,
      description: description,
      articles: articles
    };
    content += templateSections(fields);
  });
  $('#sections').append(content);

  //Content-Scroll on Navigation click.
  $('.sidenav').find('a').on('click', function (e) {
    e.preventDefault();
    var id = $(this).attr('href');
    if ($(id).length > 0) {
      $('html,body').animate({ scrollTop: parseInt($(id).offset().top) }, 1000);
    }
    window.location.hash = $(this).attr('href');
    if ($(this).parent().is(".nav-header")) {
      $('.nav-header').removeClass('active');
      $(this).parent().addClass('active');
    }
  });

  /**
   * Check if Parameter (sub) List has a type Field.
   * Example: @apiSuccess          varname1 No type.
   *          @apiSuccess {String} varname2 With type.
   *
   * @param {Object} fields
   */
  function _hasTypeInFields(fields) {
    var result = false;
    $.each(fields, function (name) {
      if (_.any(fields[name], function (item) { return item.type; }))
        result = true;
    });
    return result;
  }

  /**
   * On Template changes, recall plugins.
   */
  function initDynamic() {
    // bootstrap popover
    $('a[data-toggle=popover]')
      .popover()
      .click(function (e) {
        e.preventDefault();
      })
      ;

    var version = $('#version strong').html();
    $('#sidenav li').removeClass('is-new');
    if (apiProject.template.withCompare) {
      $('#sidenav li[data-version=\'' + version + '\']').each(function () {
        var group = $(this).data('group');
        var name = $(this).data('name');
        var length = $('#sidenav li[data-group=\'' + group + '\'][data-name=\'' + name + '\']').length;
        var index = $('#sidenav li[data-group=\'' + group + '\'][data-name=\'' + name + '\']').index($(this));
        if (length === 1 || index === (length - 1))
          $(this).addClass('is-new');
      });
    }
    $('#scrollingNav').affix({
      offset: {
        top: 100,
        bottom: function () {
          return (this.bottom = $('.footer').outerHeight(true))
        }
      }
    });
    // tabs
    $('.nav-tabs-examples a').click(function (e) {
      e.preventDefault();
      $(this).tab('show');
    });
    //$('.nav-tabs-examples').find('a:first').tab('show');

    // sample request switch
    $('.sample-request-switch').click(function (e) {
      var name = '.' + $(this).attr('name') + '-fields';
      $(name).addClass('hide');
      $(this).parent().next(name).removeClass('hide');
    });

    // init modules
    sampleRequest.initDynamic();
  }
  initDynamic();

  // Pre- / Code-Format
  prettyPrint();

  // compare url-parameter
  $.urlParam = function (name) {
    var results = new RegExp('[\\?&amp;]' + name + '=([^&amp;#]*)').exec(window.location.href);
    return (results && results[1]) ? results[1] : null;
  };

  /**
   * Add article settings.
   */
  function addArticleSettings(fields, entry) {
    // add unique id
    // TODO: replace all group-name-version in template with id.
    fields.id = fields.article.group + '-' + fields.article.name + '-' + fields.article.version;
    fields.id = fields.id.replace(/\./g, '_');

    if (entry.header && entry.header.fields)
      fields._hasTypeInHeaderFields = _hasTypeInFields(entry.header.fields);

    if (entry.parameter && entry.parameter.fields)
      fields._hasTypeInParameterFields = _hasTypeInFields(entry.parameter.fields);

    if (entry.error && entry.error.fields)
      fields._hasTypeInErrorFields = _hasTypeInFields(entry.error.fields);

    if (entry.success && entry.success.fields)
      fields._hasTypeInSuccessFields = _hasTypeInFields(entry.success.fields);

    if (entry.info && entry.info.fields)
      fields._hasTypeInInfoFields = _hasTypeInFields(entry.info.fields);

    // add template settings
    fields.template = apiProject.template;
  }

  /**
   * Render Article.
   */
  function renderArticle(group, name, version) {
    var entry = {};
    $.each(apiByGroupAndName[group][name], function (index, currentEntry) {
      if (currentEntry.version === version)
        entry = currentEntry;
    });
    var fields = {
      article: entry,
      versions: articleVersions[group][name]
    };

    addArticleSettings(fields, entry);

    return templateArticle(fields);
  }

  /**
   * Render original Article and remove the current visible Article.
   */
  function resetArticle(group, name, version) {
    var $root = $('article[data-group=\'' + group + '\'][data-name=\'' + name + '\']:visible');
    var content = renderArticle(group, name, version);

    $root.after(content);
    var $content = $root.next();

    // Event on.click muss neu zugewiesen werden (sollte eigentlich mit on automatisch funktionieren... sollte)
    $content.find('.versions li.version a').on('click', changeVersionCompareTo);

    $('#sidenav li[data-group=\'' + group + '\'][data-name=\'' + name + '\'][data-version=\'' + version + '\']').removeClass('has-modifications');

    $root.remove();
    return;
  }

  /**
   * Load google fonts.
   */
  function loadGoogleFontCss() {
    var host = document.location.hostname.toLowerCase();
    var protocol = document.location.protocol.toLowerCase();
    var googleCss = '//fonts.googleapis.com/css?family=Source+Code+Pro|Source+Sans+Pro:400,600,700';
    if (host == 'localhost' || !host.length || protocol === 'file:')
      googleCss = 'http:' + googleCss;

    $('<link/>', {
      rel: 'stylesheet',
      type: 'text/css',
      href: googleCss
    }).appendTo('head');
  }

  /**
   * Return ordered entries by custom order and append not defined entries to the end.
   * @param  {String[]} elements
   * @param  {String[]} order
   * @param  {String}   splitBy
   * @return {String[]} Custom ordered list.
   */
  function sortByOrder(elements, order, splitBy) {
    var results = [];
    order.forEach(function (name) {
      if (splitBy)
        elements.forEach(function (element) {
          var parts = element.split(splitBy);
          var key = parts[1]; // reference keep for sorting
          if (key == name)
            results.push(element);
        });
      else
        elements.forEach(function (key) {
          if (key == name)
            results.push(name);
        });
    });
    // Append all other entries that ar not defined in order
    elements.forEach(function (element) {
      if (results.indexOf(element) === -1)
        results.push(element);
    });
    return results;
  }

  window.page = window.location.hash || "#api-_";

  $(document).ready(function () {
    $.material.init();
    if (window.location.hash) {
      var id = window.location.hash;
      if (window.page != "#api-_") {
        $(id).trigger("click");
      }
    }
  });

  $(window).on("resize", function () {
    resize();
  }).trigger("resize");

  // get url parameter
  $.urlParam = function (name) {
    var results = new RegExp('[\\?&amp;]' + name + '=([^&amp;#]*)').exec(window.location.href);
    return (results && results[1]) ? results[1] : null;
  };
  
  // click menu
  $(".menu li").click(function () {
    if ($(this).is(".active")) {
      return;
    }
    $(".menu li").not($(this)).removeClass("active");
    $(this).addClass("active");
  });

  // resize window
  function resize() {
    $("html, body").height($(window).height());
    $(".main, .menu").height($(window).height() - $(".header-panel").outerHeight());
    $(".pages").height($(window).height());
  }
});
