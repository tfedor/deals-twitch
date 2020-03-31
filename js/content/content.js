
class Background {
    static async _message(message) {
        return new Promise(function (resolve, reject) {
            chrome.runtime.sendMessage(message, function(response) {
                if (!response) {
                    reject("No response from extension background context.");
                    return;
                }
                if (typeof response.error !== 'undefined') {
                    response.localStack = (new Error(message.action)).stack;
                    reject(response);
                    return;
                }
                resolve(response.response);
            });
        });
    }
    
    static action(requested, params) {
        return Background._message({ 'action': requested, 'params': params, });
    }
}


let WatchPage = (function(){

    let self = {};

    let _currentGameName = null;

    self._getGameName = async function() {
        let titleNode = document.querySelector("[data-a-target='stream-game-link']");
        if (!titleNode) { return false; }
        return titleNode.innerText;
    };

    self._createItadBox = function(url, title, subtitle, callToAction) {
        return `<span class='itad-box'>
                <span class='itad-box__title'>${title}</span>
                <span class='itad-box__subtitle'>${subtitle}</span>
                <a href='${url}' class='itad-box__cta'>${callToAction}</a>
            </span>`
    };

    self._getContentsNode = function() {
        return document.querySelector("[data-a-target='stream-game-link']");
    };

    self._removePricing = function() {
        let itadNode = document.querySelector(".itad-container");
        if (itadNode) {
            itadNode.remove();
        }
    };

    self._addPricingToPage = function(html) {

        let contentsNode = self._getContentsNode();
        if (!contentsNode) {
            let observer = new MutationObserver(() => {
                let contentsNode = self._getContentsNode();
                if (!contentsNode) { return; }

                HTML.afterEnd(contentsNode, html);
                observer.disconnect();
            });

            observer.observe(document.body, {childList: true, subtree: true});
        } else {
            HTML.afterEnd(contentsNode, html);
        }
    };

    self._loadPriceInfo = async function() {
        let gameName = await self._getGameName();

        if (!gameName) {
            console.log("Did not find game name on this page");
            self._removePricing();
            return;
        }

        if (gameName === _currentGameName) { return; }
        _currentGameName = gameName;

        self._removePricing();

        let prices = await Background.action("prices", {title: gameName});
        if (!prices) {
            console.error("Couldn't load prices for " + gameName, prices);
            return;
        }

        let price = prices.price;
        let priceBox = "";

        if (price) {
            priceBox = self._createItadBox(
                price.url,
                price.price_formatted,
                `-${price.cut}% at ${price.store}`,
                "Buy now"
            );
        }

        let itadBox = self._createItadBox(
            prices.urls.info,
            "",
            "",
            "See more"
        );

        self._addPricingToPage(
            `<div class="itad-container">
                       <img class='itad-img' src="${ExtensionResources.getURL("/img/logo.svg")}">
                       ${priceBox}${itadBox}
                   </div>`);
    };

    self._pageListener = function(contentsNode) {
        self._loadPriceInfo();
        (new MutationObserver(self._loadPriceInfo))
            .observe(contentsNode, {childList: true, subtree: true});
    };


    self.init = async function() {
        console.log("Game prices for Twitch v" + Info.version + " by https://isthereanydeal.com/");

        let contents = document.querySelector("[data-a-target='stream-game-link']");
        if (!contents) {
            let metaObserver = new MutationObserver(() => {
                let metaContents = document.querySelector("[data-a-target='stream-game-link']");
                if (!metaContents) { return; }
                self._loadPriceInfo();
                metaObserver.disconnect()
            });
            metaObserver.observe(document.body, { childList: true, subtree: true });
        } else {
            self._loadPriceInfo();
        }
    };

    return self;
})();


WatchPage.init();
