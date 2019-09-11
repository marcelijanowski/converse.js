/**
 * @module dom-navigator
 * @description This module started as a fork of Rubens Mariuzzo's dom-navigator.
 *  https://github.com/rmariuzzo/dom-navigator
 * @copyright Rubens Mariuzzo, JC Brand
 */
import log from  "@converse/headless/log";
import u from './utils/html';


/**
 * Indicates if a given element is fully visible in the viewport.
 * @param {Element} el The element to check.
 * @return {Boolean} True if the given element is fully visible in the viewport, otherwise false.
 */
function inViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
    );
}

/**
 * Return the absolute offset top of an element.
 * @param el {Element} The element.
 * @return {Number} The offset top.
 */
function absoluteOffsetTop(el) {
    let offsetTop = 0;
    do {
        if (!isNaN(el.offsetTop)) {
            offsetTop += el.offsetTop;
        }
    } while ((el = el.offsetParent));
    return offsetTop;
}

/**
 * Return the absolute offset left of an element.
 * @param el {Element} The element.
 * @return {Number} The offset left.
 */
function absoluteOffsetLeft(el) {
    let offsetLeft = 0;
    do {
        if (!isNaN(el.offsetLeft)) {
            offsetLeft += el.offsetLeft;
        }
    } while ((el = el.offsetParent));
    return offsetLeft;
}


/**
 * Adds the ability to navigate the DOM with the arrow keys
 * @class
 * @namespace DOMNavigator
 */
class DOMNavigator {
    /**
     * Directions.
     * @returns {{left: string, up: string, right: string, down: string}}
     * @constructor
     */
    static get DIRECTION () {
        return {
            left: 'left',
            up: 'up',
            right: 'right',
            down: 'down'
        };
    }

    /**
     * Default options.
     * @returns {{mode: string, selected: string, left: number, up: number, right: number, down: number}}
     * @constructor
     */
    static get DEFAULTS () {
        return {
            selected: 'selected',
            selector: 'li',
            left: 37,
            up: 38,
            right: 39,
            down: 40,
        };
    }

    /**
     * Create a new DOM Navigator.
     * @param container {Element} The container of the element to navigate.
     * @param options {Object} The options to configure the DOM navigator.
     */
    constructor(container, options) {
        this.doc = window.document;
        this.container = container;
        this.scroll_container = options.scroll_container || container;
        this.options = Object.assign({}, DOMNavigator.DEFAULTS, options);
        this.init();
    }

    /**
     * Initialize the navigator.
     * @method DOMNavigator#init
     */
    init () {
        this.selected = null;
        this.keydownHandler = null;

        // Create hotkeys map.
        this.keys = {};
        this.keys[this.options.left] = DOMNavigator.DIRECTION.left;
        this.keys[this.options.up] = DOMNavigator.DIRECTION.up;
        this.keys[this.options.right] = DOMNavigator.DIRECTION.right;
        this.keys[this.options.down] = DOMNavigator.DIRECTION.down;
    }

    /**
     * Enable this navigator.
     * @method DOMNavigator#enable
     */
    enable () {
        log.info('enable');
        this.getElements();
        this.keydownHandler = event => this.handleKeydown(event);
        this.doc.addEventListener('keydown', this.keydownHandler);
        this.enabled = true;
    }

    /**
     * Disable this navigator.
     * @method DOMNavigator#disable
     */
    disable () {
        log.info('disable');
        if (this.keydownHandler) {
            this.doc.removeEventListener('keydown', this.keydownHandler);
        }
        this.unselect();
        this.enabled = false;
    }

    /**
     * Destroy this navigator removing any event registered and any other data.
     * @method DOMNavigator#destroy
     */
    destroy () {
        this.disable();
        if (this.container.domNavigator) {
            delete this.container.domNavigator;
        }
    }

    /**
     * @method DOMNavigator#getNextElement
     * @param {'down'|'right'|'left'|'up'} direction
     * @returns {HTMLElement}
     */
    getNextElement (direction) {
        if (direction === DOMNavigator.DIRECTION.right) {
            return u.getNextElement(this.selected, this.options.selector);
        } else if (direction == DOMNavigator.DIRECTION.left) {
            return u.getPreviousElement(this.selected, this.options.selector);
        }

        let els, left, top, getDistance;
        if (direction == DOMNavigator.DIRECTION.down) {
            left = this.selected.offsetLeft;
            top = this.selected.offsetTop + this.selected.offsetHeight;
            els = this.elementsAfter(0, top);
            getDistance = el => Math.abs(el.offsetLeft - left) + Math.abs(el.offsetTop - top);
        } else if (direction == DOMNavigator.DIRECTION.up) {
            left = this.selected.offsetLeft;
            top = this.selected.offsetTop - 1;
            els = this.elementsBefore(Infinity, top);
            getDistance = el => Math.abs(left - el.offsetLeft) + Math.abs(top - el.offsetTop);
        } else {
            throw new Error("getNextElement: invalid direction value");
        }
        const next = els.reduce((prev, curr) => {
            const current_distance = getDistance(curr);
            if (current_distance < prev.distance) {
                return {
                    distance: current_distance,
                    element: curr
                };
            }
            return prev;
        }, {
            distance: Infinity
        });
        return next.element;
    }

    /**
     * Return the selected DOM element.
     * @method DOMNavigator#selected
     * @return {Element} The selected DOM element.
     */
    selected () {
        return this.selected;
    }

    /**
     * Select the given element.
     * @method DOMNavigator#select
     * @param {Element} el The DOM element to select.
     * @param {string} [direction] The direction.
     */
    select (el, direction) {
        if (!el || el === this.selected) {
            return;
        }
        this.unselect();
        direction && this.scrollTo(el, direction);
        if (el.matches('input')) {
            el.focus();
        } else {
            u.addClass(this.options.selected, el);
        }
        this.selected = el;
    }

    /**
     * Remove the current selection
     * @method DOMNavigator#unselect
     */
    unselect () {
        if (this.selected) {
            u.removeClass(this.options.selected, this.selected);
            delete this.selected;
        }
    }

    /**
     * Scroll the container to an element.
     * @method DOMNavigator#scrollTo
     * @param el {Element} The destination element.
     * @param direction {String} The direction of the current navigation.
     * @return void.
     */
    scrollTo (el, direction) {
        if (!this.inScrollContainerViewport(el)) {
            const container = this.scroll_container;
            switch (direction) {
                case DOMNavigator.DIRECTION.left:
                    container.scrollLeft = el.offsetLeft - container.offsetLeft;
                    break;
                case DOMNavigator.DIRECTION.up:
                    container.scrollTop = el.offsetTop - container.offsetTop;
                    break;
                case DOMNavigator.DIRECTION.right:
                    container.scrollLeft = el.offsetLeft - container.offsetLeft - (container.offsetWidth - el.offsetWidth);
                    break;
                case DOMNavigator.DIRECTION.down:
                    container.scrollTop = el.offsetTop - container.offsetTop - (container.offsetHeight - el.offsetHeight);
                    break;
            }
        } else if (!inViewport(el)) {
            switch (direction) {
                case DOMNavigator.DIRECTION.left:
                    document.body.scrollLeft = absoluteOffsetLeft(el) - document.body.offsetLeft;
                    break;
                case DOMNavigator.DIRECTION.up:
                    document.body.scrollTop = absoluteOffsetTop(el) - document.body.offsetTop;
                    break;
                case DOMNavigator.DIRECTION.right:
                    document.body.scrollLeft = absoluteOffsetLeft(el) - document.body.offsetLeft - (document.documentElement.clientWidth - el.offsetWidth);
                    break;
                case DOMNavigator.DIRECTION.down:
                    document.body.scrollTop = absoluteOffsetTop(el) - document.body.offsetTop - (document.documentElement.clientHeight - el.offsetHeight);
                    break;
            }
        }
    }

    /**
     * Indicate if an element is in the container viewport.
     * @method DOMNavigator#inScrollContainerViewport
     * @param el {Element} The element to check.
     * @return {Boolean} true if the given element is in the container viewport, otherwise false.
     */
    inScrollContainerViewport(el) {
        const container = this.scroll_container;
        // Check on left side.
        if (el.offsetLeft - container.scrollLeft < container.offsetLeft) {
            return false;
        }
        // Check on top side.
        if (el.offsetTop - container.scrollTop < container.offsetTop) {
            return false;
        }
        // Check on right side.
        if ((el.offsetLeft + el.offsetWidth - container.scrollLeft) > (container.offsetLeft + container.offsetWidth)) {
            return false;
        }
        // Check on down side.
        if ((el.offsetTop + el.offsetHeight - container.scrollTop) > (container.offsetTop + container.offsetHeight)) {
            return false;
        }
        return true;
    }

    /**
     * Find and store the navigable elements
     * @method DOMNavigator#getElements
     */
    getElements () {
        this.elements = Array.from(this.container.querySelectorAll(this.options.selector));
    }

    /**
     * Return an array of navigable elements after an offset.
     * @method DOMNavigator#elementsAfter
     * @param {number} left The left offset.
     * @param {number} top The top offset.
     * @return {Array} An array of elements.
     */
    elementsAfter(left, top) {
        return this.elements.filter(el => el.offsetLeft >= left && el.offsetTop >= top);
    }

    /**
     * Return an array of navigable elements before an offset.
     * @method DOMNavigator#elementsBefore
     * @param {number} left The left offset.
     * @param {number} top The top offset.
     * @return {Array} An array of elements.
     */
    elementsBefore(left, top) {
        return this.elements.filter(el => el.offsetLeft <= left && el.offsetTop <= top);
    }

    /**
     * Handle the key down event.
     * @method DOMNavigator#handleKeydown
     * @param {Event} event The event object.
     */
    handleKeydown (event) {
        log.info('handleKeydown');
        const direction = this.keys[event.which];
        if (direction) {
            event.preventDefault();
            const next = this.selected ? this.getNextElement(direction) : this.elements[0];
            this.select(next, direction);
        }
    }
}

export default DOMNavigator;
