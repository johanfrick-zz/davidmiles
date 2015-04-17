require.register('data-request/index', function(require, exports, module) {var request = require('utils/request');

exports.getJson = function (jsonName, callback) {
	request.get('/json/' + jsonName + '.json', function (res) {
		if (res.status === 200) {
			var json = JSON.parse(res.text);
			callback(json);
		}
	});
};

exports.getText = function (textName, callback) {
	request.get('/texter/' + textName, function (res) {
		if (res.status === 200) {
			callback(res.text);
		}
	});
};

exports.get = request.get;});
window.cogwheels.addFeature({name: "data-request", version: "0.0.0"});
require.register('start/index', function(require, exports, module) {var router = require('router');
var main = require('main');
var bus = require('message-bus');

exports.start = function () {
    var firstRender = true;
    router.on('/', function (ctx) {
            main.render();
            firstRender = false;
        }
    );
    router.on('/:page', function (ctx) {
            var page = ctx.params.page;
            if (page.indexOf('#') === 0) {
                page = page.substr(1);
                if (!firstRender) {
                    bus.publish('main-content', page);
                } else {
                    firstRender = false;
                    main.render(page);
                }
            }
        }
    );
};

exports.controllers = [];});
window.cogwheels.addFeature({name: "start", version: "0.0.0"});
require.register('gallery/index', function(require, exports, module) {var template = require('./template');
var viewModel = require('./view-model');

exports.init = function () {
    ko.components.register('gallery', component);
};

var component = {
    viewModel: {
        'createViewModel': viewModel.create
    },
    template: template
};});
require.register('gallery/template', function(require, exports, module) {module.exports = "<div class=\"photos\"><div class=\"fotorama\" data-auto=\"false\" data-nav=\"thumbs\" data-bind=\"attr:{'data-width':width, 'data-height':height}\"></div></div>";});
require.register('gallery/view-model', function(require, exports, module) {var request = require('data-request');

function setSize(obj) {
    var mainContent = $('.mainContent');
    obj.width = mainContent.width();
    obj.height = mainContent.height() - 80;
}
var viewModel = {
    init: function (params) {
        var self = this;
        setSize(this);
        request.getJson(params.jsonName, function (images) {
            setTimeout(function () {
                images.forEach(function (image) {
                    image.caption = image.text;
                    image.img = image.url;
                    image.thumb = image.url;
                    image.full = image.url;
                });
                var fotorama = $('.fotorama').fotorama({
                    data: images,
                    allowfullscreen: true,
                    autoplay: '5000',
                    loop: true,
                    arrows: 'always',
                    shuffle: true
                });
                $(window).resize(function () {
                    var resize = {};
                    setSize(resize);
                    fotorama.resize(resize);
                });
            }, 0);
        });
    }
};


module.exports.create = function (params) {
    var vm = Object.create(viewModel);
    vm.init(params);
    return vm;
};
});
window.cogwheels.addFeature({name: "gallery", version: "0.0.0"});
require.register('iframe-list/index', function(require, exports, module) {var template = require('./template');
var viewModel = require('./view-model');

exports.init = function () {
    ko.components.register('iframe-list', component);
};

var component = {
    viewModel: {
        'createViewModel': viewModel.create
    },
    template: template
};});
require.register('iframe-list/template', function(require, exports, module) {module.exports = "<div class=\"lazyIFrames\" data-bind=\"foreach: items\"><div class=\"card\" data-bind=\"style: {width: width}\"><div class=\"iFrameTitle\" data-bind=\"text: title\"></div><paper-shadow z=\"2\" style=\"background-size: 100%\" data-bind=\"style: {backgroundImage: image, width: width, height: height}\"><div data-bind=\"click: $parent.click, css: $parent.playIconClass\"><div class=\"replaceMe\"></div></div></paper-shadow></div></div>";});
require.register('iframe-list/view-model', function(require, exports, module) {var viewModel = {
    init: function (params) {
        this.playIconClass = 'play ' + params.playIconClass;
        this.items = params.items;
        this.click = showIFrame;
    }
};

function showIFrame(item, event) {
    var element = event.currentTarget;
    var iframe = document.createElement('iframe');
    var iframeUrl = item.iFrameUrl;
    if (element.getAttribute('data-params')) {
        iframeUrl += '&' + element.getAttribute('data-params');
    }
    iframe.setAttribute('src', iframeUrl);
    iframe.setAttribute('frameborder', '0');
    if (item.fill) {
        iframe.style.width = element.parentElement.style.width;
        iframe.style.height = element.parentElement.style.height;
    } else {
        iframe.style.display = 'block';
    }
    element.replaceChild(iframe, element.querySelector('.replaceMe'));
    element.className = 'play';
}

module.exports.create = function (params) {
    var vm = Object.create(viewModel);
    vm.init(params);
    return vm;
};
});
window.cogwheels.addFeature({name: "iframe-list", version: "0.0.0"});
require.register('main/index', function(require, exports, module) {var layoutEngine = require('layout-engine');
var template = require('./template');
var viewModel = require('./view-model').create();
var request = require('data-request');

var urlPage;

exports.init = function () {
    request.getJson('menu', function (sections) {
        sections.forEach(function (section) {
            if (!section.header) {
                var name = section.id || section.text.toLowerCase();
                var component = {
                    viewModel: {
                        'createViewModel': function () {
                            var viewModel = require('./' + name + '/view-model');
                            var vm = Object.create(viewModel);
                            vm.init();
                            return vm;
                        }
                    },
                    template: require('./' + name + '/template')
                };
                ko.components.register(name, component);
            }
        });
        viewModel.createSections(urlPage);
    });
};

exports.render = function (page) {
    urlPage = page;
    layoutEngine.render(template, viewModel, 'site');
};});
require.register('main/template', function(require, exports, module) {module.exports = "<div class=\"main\"><div class=\"navbar navbar-default navbar-fixed-top\" role=\"navigation\"><div class=\"container\"><div class=\"navbar-header\"><button type=\"button\" class=\"navbar-toggle animated rollIn\" data-toggle=\"offcanvas\" data-target=\".sidebar-nav\"><span class=\"icon-bar\"></span> <span class=\"icon-bar\"></span> <span class=\"icon-bar\"></span></button> <img class=\"drawerPhoto\" src=\"/img/drawer_photo.jpg\"> <img class=\"logo\" src=\"/img/logo.png\"></div></div></div><div class=\"container\"><div class=\"row row-offcanvas row-offcanvas-left\"><div class=\"col-xs-6 col-sm-2 sidebar-offcanvas\" id=\"sidebar\" role=\"navigation\"><ul class=\"nav\" data-bind=\"foreach: sections\"><li class=\"item\" data-bind=\"click: select, css: {'item-selected' : selected(), 'animated flash': initPage(), 'menu-header': header}, text:text\"></li></ul></div><div class=\"col-xs-12 col-sm-10 mainContent\" data-bind=\"if: mainContent()\"><div data-bind=\"component: {name: mainContent}\"></div></div></div></div></div>";});
require.register('main/view-model', function(require, exports, module) {var bus = require('message-bus');
var request = require('data-request');
var router = require('router');

var viewModel = {
    init: function () {
        var self = this;
        self.mainContent = ko.observable('');
        self.sections = ko.observableArray();
        bus.subscribe('main-content', function (item) {
            var section = item.data.toLowerCase();
            self.mainContent(section);
        });
    },
    createSections: function (selected) {
        var self = this;
        request.getJson('menu', function (sections) {
            sections.forEach(function (section, index) {
                section.initPage = ko.observable(false);
                section.header = section.header || false;
                section.id = section.id || section.text.toLowerCase();
                section.selected = ko.computed(function () {
                    return section.id === self.mainContent();
                });
                section.select = function () {
                    if (!section.header) {
                        router.navigate('/#' + section.id);
                        document.querySelector('#sidebar').parentElement.className = 'row row-offcanvas row-offcanvas-left';
                    }
                };
                if (!selected) {
                    if (section.startPage) {
                        section.select();
                        section.initPage(true);
                    }
                }
                self.sections.push(section);
            });
            if (selected)  {
                bus.publish('main-content', selected);
            }
        });
    }
};


module.exports.create = function () {
    var vm = Object.create(viewModel);
    vm.init();
    return vm;
};
});
require.register('main/bilder-artist/template', function(require, exports, module) {module.exports = "<gallery params=\"jsonName: 'bilder-artist'\"></gallery>";});
require.register('main/bilder-artist/view-model', function(require, exports, module) {module.exports = {
    init: function () {
    }
};
});
require.register('main/bilder-trubadur/template', function(require, exports, module) {module.exports = "<gallery params=\"jsonName: 'bilder-trubadur'\"></gallery>";});
require.register('main/bilder-trubadur/view-model', function(require, exports, module) {module.exports = {
    init: function () {
    }
};
});
require.register('main/discografi/template', function(require, exports, module) {module.exports = "<div data-bind=\"visible:loading\" class=\"animated fadeIn\">Läser in album...</div><!--ko if: !loading()--><div data-bind=\"if: albums().length === 0\">Inga album upplagda för tillfället. Återkom gärna senare!</div><div data-bind=\"foreach: albums\"><div class=\"card discography animated fadeIn\" data-bind=\"if: hasImage\"><div class=\"discoInfo\"><div class=\"discoYear\" data-bind=\"text: date\"></div><div horizontal layout justified><div class=\"discoTitle\" data-bind=\"text: title\"></div><div class=\"discoTrackCount\"><span data-bind=\"text: trackCount() + ' spår'\"></span></div></div></div><div style=\"background-size: 100%\" data-bind=\"style: {backgroundImage: image, width: width, height: height}\"></div><div class=\"discoLinks\" horizontal end-justified layout center><a href=\"\" target=\"_blank\" data-bind=\"visible: shopUrl, attr:{href: shopUrl}\"><img class=\"shoppingCart\" src=\"img/shopping-cart.png\" border=\"0\"></a> <a href=\"\" target=\"_blank\" data-bind=\"attr:{href: iTunesUrl}\"><img src=\"img/itunes.png\" border=\"0\"></a> <a href=\"\" target=\"_blank\" data-bind=\"attr:{href: spotifyUrl}\"><img src=\"img/spotify-logo-32x32-no-tagline.png\" border=\"0\"></a></div></div></div><!--/ko-->";});
require.register('main/discografi/view-model', function(require, exports, module) {var request = require('data-request');

module.exports = {
    init: function () {
        var self = this;
        self.albums = ko.observableArray();
        this.loading = ko.observable(true);
        request.getJson('spotify_albums', function (albums) {
            self.loading(false);
            albums.forEach(function (album) {
                album.spotifyUrl = 'http://open.spotify.com/album/' + album.spotifyId;
                album.iTunesUrl = 'https://itunes.apple.com/us/album/' + album.iTunesId;
                album.shopUrl = album.shopId ? 'http://davidmiles.tictail.com/product/' + album.shopId : false;
                album.title = ko.observable();
                album.date = ko.observable();
                album.trackCount = ko.observable();
                album.image = ko.observable();
                album.width = '250px';
                album.height = '250px';
                album.hasImage = ko.computed(function() {
                    return album.image() !== undefined;
                });
                request.get('https://api.spotify.com/v1/albums/' + album.spotifyId, function (result) {
                    if (!result.body.error) {
                        var images = result.body.images;
                        album.title(result.body.name);
                        album.date(result.body['release_date'].replace(/-.*/, ''));
                        album.trackCount(result.body.tracks.items.length);
                        images.forEach(function (image) {
                            if (image.height === 300) {
                                album.image('url(' + image.url + ')');
                            }
                        });
                    } else {
                        self.albums.remove(album);
                    }
                });
                self.albums.push(album);
            });
        });
    }
};});
require.register('main/gastbok/template', function(require, exports, module) {module.exports = "<iframe src=\"http://www.gastbok.nu/gb/54314/\" width=\"100%\" height=\"100%\" frameborder=\"0\"></iframe>";});
require.register('main/gastbok/view-model', function(require, exports, module) {module.exports = {
    init: function () {

    }
};});
require.register('main/hem/template', function(require, exports, module) {module.exports = "<div><p>David Miles är en låtskrivare, gitarrist och sångare uppvuxen i Göteborg men numera bosatt i Malmö. Han har gett ut 3 skivor sedan 2008. Den senaste skivan <a href=\"http://open.spotify.com/album/5nrPJLz8D9BAwBkUYyISWi\">Tiden är ett jetplan</a> gavs ut hösten 2012.</p><p>2011 hade David en radiohit med låten <a href=\"http://open.spotify.com/album/5RyzFjnNSYWYHdP5Nn9SDp\">Det är bara så det är</a>.</p><p>Många krogar, restauranger, eventbolag mm bokar David som trubadur. Efter flera år som flitig underhållare på uteserveringar och pubar runt om i landet är han med sitt genuina och äkta sound alltid mycket omtyckt.</p><p>David medverkar även i <a href=\"\" data-bind=\"click:goToPodcast\">podcasten Sjöwall & Miles</a> där det släpps ett nytt avsnitt ungefär en gång i månaden.</p><div center-justified><paper-shadow z=\"1\" class=\"card homeImage\"><img src=\"/img/spelplan.jpg\"></paper-shadow><paper-shadow z=\"1\" class=\"card homeImage\"><img src=\"/img/press/david_press_7_medium.jpg\"></paper-shadow></div><div class=\"musicServices\" horizontal center-justified layout><a href=\"http://www.facebook.com/pages/David-Miles/155341767874341\" target=\"_blank\"><img src=\"img/facebook.jpeg\" border=\"0\"></a> <a href=\"http://open.spotify.com/artist/4z4NwEHgD7Ykjs1L0gsKCI\" target=\"_blank\"><img src=\"img/spotify-logo-32x32-no-tagline.png\" border=\"0\"></a> <a href=\"https://itunes.apple.com/us/artist/david-miles/id304549972\" target=\"_blank\"><img src=\"img/itunes.png\" border=\"0\"></a></div></div>";});
require.register('main/hem/view-model', function(require, exports, module) {var bus = require('message-bus');

module.exports = {
    init: function () {

    },
    goToTrubadur: function() {
        bus.publish('main-content', 'info-trubadur');
    },
    goToPodcast: function() {
        bus.publish('main-content', 'podcast');
    }

};});
require.register('main/info-trubadur/template', function(require, exports, module) {module.exports = "Här ska det finnas text om trubaduren";});
require.register('main/info-trubadur/view-model', function(require, exports, module) {var request = require('data-request');

module.exports = {
    init: function () {

    }
};});
require.register('main/kontakt/template', function(require, exports, module) {module.exports = "<div><div class=\"marginBottom\">Kontakta David Miles på<div>E-post: <a href=\"mailto:david@davidmiles.se\">david@davidmiles.se</a></div><div>Telefon: <a href=\"tel:0706-979604\">0706-979604</a></div></div><paper-shadow z=\"1\" class=\"contactImage\"><img src=\"img/press/david_press_18.jpg\"></paper-shadow><div class=\"marginBottom\" vertical layout>Kontakta skivbolag på <a href=\"http://www.hansarenmusik.se\" target=\"_blank\">www.hansarenmusik.se</a></div><div horizontal layout><div>Sidan är skapad av</div><a class=\"spaced\" href=\"https://se.linkedin.com/in/johanfrick\">Johan Frick</a></div></div>";});
require.register('main/kontakt/view-model', function(require, exports, module) {module.exports = {
    init: function () {

    }
};});
require.register('main/press/template', function(require, exports, module) {module.exports = "<div vertical layout center><b>Pressmeddelande</b> <a href=\"/img/130607_davidmiles.se_pressmeddelande.pdf\" target=\"_blank\">2013-06-07 David Miles Konserter sommaren 2013</a> <a href=\"/img/121016_davidmiles.se_pressmeddelande.pdf\" target=\"_blank\">2012-10-16 David Miles släpper nya skivan Tiden är ett jetplan!</a> <a href=\"/img/120625_davidmiles.se_pressmeddelande.pdf\" target=\"_blank\">2012-06-25 David Miles ger ut ny skiva hösten 2012!</a> <b class=\"pressImages\">Pressbilder</b><div data-bind=\"foreach: images\"><paper-shadow z=\"2\" class=\"card\"><a data-bind=\"attr: {href: url, 'data-title': downloadLink}\" data-lightbox=\"image-1\" data-title=\"\"><img data-bind=\"attr: {src: thumb}\"></a></paper-shadow></div></div>";});
require.register('main/press/view-model', function(require, exports, module) {module.exports = {
    init: function () {
        var images = [];
        for (var i = 1; i <= 22; i++) {
            var fullUrl = 'img/press/david_press_' + i + '.jpg';
            images.push(
                {
                    thumb: 'img/press/david_press_' + i + '_thumbnail.jpg',
                    url: fullUrl,
                    downloadLink: '<a href="' + fullUrl + '" target="_blank">Klicka här för att ladda ner</a>'
                }
            );
        }
        this.images = images;
    }
};});
require.register('main/podcast/template', function(require, exports, module) {module.exports = "<img class=\"max100\" src=\"/img/podcast.jpg\"><div class=\"podcasts\"><div class=\"animated fadeIn\" data-bind=\"if:podcasts().length === 0\">Inga podcasts tillgängliga</div><div data-bind=\"foreach: podcasts\"><div class=\"animated fadeIn\"><a href=\"\" data-bind=\"attr:{href: url}, text: title\" target=\"_blank\"></a></div></div></div>";});
require.register('main/podcast/view-model', function(require, exports, module) {var request = require('data-request');

module.exports = {
    init: function () {
        var self = this;
        this.podcasts = ko.observableArray([{title: 'Läser in podcast-listan...', url: ''}]);
        request.getJson('podcast', function (podcasts) {
            podcasts.forEach(function (podcast) {
                podcast.url = 'http://sjowallmiles.podomatic.com/entry/' + podcast.podomaticId;
            });
            self.podcasts(podcasts);
        });
    }
};
});
require.register('main/recensioner/template', function(require, exports, module) {module.exports = "<div class=\"reviews\" data-bind=\"foreach: items\"><!--ko if: hasImage--><img class=\"reviewAlbums\" src=\"\" data-bind=\"attr: {src: albumImage}\"><!--/ko--><!--ko if: hasText --><div><a href=\"\" target=\"_blank\" data-bind=\"attr: {href: link}, text: text\"></a></div><!--/ko--></div>";});
require.register('main/recensioner/view-model', function(require, exports, module) {var request = require('data-request');

module.exports = {
    init: function () {
        var self = this;
        this.items = ko.observableArray();
        request.getJson('recensioner', function (items) {
            items.forEach(function(item) {
                item.hasImage = item.albumImage !== undefined;
                item.hasText = item.text !== undefined;
            });
            self.items(items);
        });
    }
};});
require.register('main/referenser/template', function(require, exports, module) {module.exports = "<div horizontal center-justified layout wrap data-bind=\"foreach: references\"><div vertical layout class=\"quote\"><div data-bind=\"text:text\" class=\"quoteText\"></div><div data-bind=\"text:source\" class=\"quoteSource\"></div></div></div>";});
require.register('main/referenser/view-model', function(require, exports, module) {var request = require('data-request');

module.exports = {
    init: function () {
        this.references = ko.observableArray();
        request.getJson('referenser', function(references) {
            references.forEach(function(reference) {
               reference.text = '”' + reference.text + '”';
            });
            this.references(references);
        }.bind(this));
    }
};});
require.register('main/shop/template', function(require, exports, module) {module.exports = "Shoppen öppnas i ett nytt fönster. <a href=\"http://davidmiles.tictail.com/\">Klicka här</a> för att öppna den igen.";});
require.register('main/shop/view-model', function(require, exports, module) {module.exports = {
    init: function () {
        var win = window.open('http://davidmiles.tictail.com/', '_blank');
        win.focus();
    }
};});
require.register('main/spelplan/template', function(require, exports, module) {module.exports = "<img src=\"/img/spelplan.jpg\" class=\"card floatRight halfWidth\"><div data-bind=\"visible:loading\" class=\"animated fadeIn\">Läser in spelplanen...</div><!--ko if: !loading()--><div class=\"animated fadeIn\"><div class=\"marginBottom bigger\" data-bind=\"with: first\"><div class=\"red\">Nästa spelning <span data-bind=\"text: distance\"></span></div><div>Datum: <span data-bind=\"text: date\"></span></div><div>Plats: <span data-bind=\"text: place\"></span></div></div><div class=\"red\">Kommande</div><div data-bind=\"if:upcoming().length === 0\">Inga spelningar inbokade</div><div class=\"marginBottom\" data-bind=\"foreach: upcoming\"><div><span class=\"bold\" data-bind=\"text: date\"></span> <span data-bind=\"text: place\"></span></div></div><div data-bind=\"if:history().length > 0\"><div class=\"red\">Tidigare</div><div data-bind=\"foreach: history\"><div><span class=\"bold\" data-bind=\"text: date\"></span> <span data-bind=\"text: place\"></span></div></div></div></div><!--/ko-->";});
require.register('main/spelplan/view-model', function(require, exports, module) {var request = require('data-request');

module.exports = {
    init: function () {
        var self = this;
        this.first = ko.observable();
        this.upcoming = ko.observableArray();
        this.history = ko.observableArray();
        this.loading = ko.observable(true);
        request.getJson('spelplan', function (gigs) {
            self.loading(false);
            gigs.forEach(function (gig) {
                var gigDate = new Date(gig.date);
                var now = new Date();
                now.setHours(0, 0, 0, 0);
                gigDate.setHours(0, 0, 0, 0);
                if (now <= gigDate) {
                    if (!self.first()) {
                        var diff = dayDiff(now, gigDate);
                        if (diff === 0) {
                            gig.distance = 'är idag!';
                        } else {
                            gig.distance = 'är om ' + diff + ' dagar';
                        }
                        self.first(gig);
                    } else {
                        self.upcoming.push(gig);
                    }
                } else {
                    self.history.unshift(gig);
                }
            });
        });

    }
};

function dayDiff(first, second) {
    return parseInt((second - first) / (1000 * 60 * 60 * 24));
}});
require.register('main/texter/template', function(require, exports, module) {module.exports = "<div data-bind=\"foreach: lyrics\"><div class=\"animated fadeIn\"><a href=\"\" data-bind=\"text: title, click: click, css: {'bold animated pulse': selected()}\"></a></div><div class=\"hiddenLyrics\" data-bind=\"html: text, css: {'visibleLyrics': selected}\"></div></div>";});
require.register('main/texter/view-model', function(require, exports, module) {var request = require('data-request');

module.exports = {
    init: function () {
        var self = this;
        this.lyrics = ko.observableArray();
        self.selected = ko.observable();
        request.getJson('texter', function (lyricsList) {
            lyricsList.forEach(function (lyricsItem) {
                request.getText(lyricsItem.textFile, function (text) {
                    lyricsItem.text = text.replace(/(?:\r\n|\r|\n)/g, '<br>');
                    lyricsItem.selected = ko.observable(false);
                    lyricsItem.click = function () {
                        if (lyricsItem.selected()) {
                            lyricsItem.selected(false);
                        } else {
                            self.lyrics().forEach(function (item) {
                                item.selected(false);
                            });
                            lyricsItem.selected(true);
                        }
                    };
                    self.lyrics.push(lyricsItem);
                });
            });
        });
    }
};});
require.register('main/video/template', function(require, exports, module) {module.exports = "<iframe-list params=\"items:videos, playIconClass: 'youtube'\"></iframe-list>";});
require.register('main/video/view-model', function(require, exports, module) {var request = require('utils/request');
var dataRequest = require('data-request');


module.exports = {
    init: function () {
        var self = this;
        this.videos = ko.observableArray();
        dataRequest.getJson('video-artist', function (ids) {
            var videos = ids.map(function (id) {
                var video = {
                    id: id,
                    iFrameUrl: 'https://www.youtube.com/embed/' + id + '?autoplay=1&autohide=1&origin=http://davidmiles.se',
                    image: 'url(http://i.ytimg.com/vi/' + id + '/mqdefault.jpg)',
                    title: ko.observable(),
                    width: '320px',
                    height: '180px',
                    fill: true
                };
                request('GET', 'http://gdata.youtube.com/feeds/api/videos/' + video.id + '?alt=json').end(function (result) {
                    video.title(result.body.entry.title.$t);
                });
                return video;
            });
            self.videos(videos);
        });
    }
};
});
require.register('main/video-trubadur/template', function(require, exports, module) {module.exports = "<div vertical layout>Här kommer det snart finnas videor från Davids trubadurgig...</div>";});
require.register('main/video-trubadur/view-model', function(require, exports, module) {module.exports = {
    init: function () {

    }
};});
window.cogwheels.addFeature({name: "main", version: "0.0.0"});
//# sourceMappingURL=../maps/gears-a8020d31.js.map