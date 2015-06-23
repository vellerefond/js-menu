(() => {
	'use strict';

	function getClassSpec(classSet) {
		let classSpec = [];
		for (let c of classSet.values())
			classSpec.push(c);
		return classSpec.sort().join(' ').trim();
	}

	function getClassSet(classSpec = "") {
		return new Set(classSpec.trim().split(/\s+/));
	}

	function hasClass(classSpec) {
		if (!this || !this.getAttribute)
			return false;
		let classAttr = this.getAttribute('class');
		if (!classAttr)
			return false;
		let
			classSet = getClassSet(classAttr),
			classConditions = classSpec.trim().split(/\s+/);
		classConditions.forEach((value, index) => classConditions[index] = value.split(/\.+/));
		for (let classCondition of classConditions) {
			let atLeastOne = true;
			for (let classConditionPart of classCondition) {
				if (classConditionPart[0] === '!'
							? classSet.has(classConditionPart.substring(1).replace(/\\!/g, '!'))
							: !classSet.has(classConditionPart.replace(/\\!/g, '!')))
					atLeastOne = false;
			}
			if (atLeastOne)
				return true;
		}
		return false;
	}

	function addClass(klass) {
		if (!this || !this.getAttribute)
			return this;
		this.setAttribute('class', getClassSpec(getClassSet(this.getAttribute('class')).add(klass)));
		return this;
	}

	function removeClass(klass) {
		if (!this || !this.getAttribute)
			return this;
		let classAttr = this.getAttribute('class');
		if (!classAttr)
			return this;
		let classSet = getClassSet(classAttr);
		if (!classSet.delete(klass))
			return this;
		if (classSet.size === 0) {
			this.removeAttribute('class');
			return this;
		}
		this.setAttribute('class', getClassSpec(classSet));
		return this;
	}

	function getWindowMetrics() {
		return {
			w: window.innerWidth, h: window.innerHeight,
			vx: window.pageXOffset , vy: window.pageYOffset,
			vxw: window.innerWidth + window.pageXOffset, vyh: window.innerHeight + window.pageYOffset
		};
	}

	function getElementMetrics(element) {
		if (!(element instanceof HTMLElement)) {
			return { x: 0, y: 0, w: 0, h: 0 };
		}

		let boundingClientRect = element.getBoundingClientRect(),
				offsetLeft = boundingClientRect.left, offsetTop = boundingClientRect.top,
				display,
				metrics = {};

		if (!element.offsetTop && !element.offsetLeft && !element.offsetWidth && !element.offsetHeight) {
			/* THE ELEMENT IS NOT RENDERED */
			display = element.style.display;
			element.style.display = "block";
		}

		metrics = {
			x: offsetLeft, y: offsetTop,
			w: element.offsetWidth, h: element.offsetHeight,
			xw: offsetLeft + element.offsetWidth, yh: offsetTop + element.offsetHeight,
			vx: offsetLeft - window.pageXOffset, vy: offsetTop - window.pageYOffset,
			vxw: offsetLeft + element.offsetWidth - window.pageXOffset, vyh: offsetTop + element.offsetHeight - window.pageYOffset
		};

		if (display)
			element.style.display = display;

		return metrics;
	}

	function getMenuAndMenuRoots(menuItem) {
		let menuRootsContainer, menuRoots = [];
		for (let i in menuItem.childNodes)
			if (hasClass.call(menuItem.childNodes[i], 'menu')) {
				menuRootsContainer = menuItem.childNodes[i];
				for (let j in menuRootsContainer.childNodes)
					if (hasClass.call(menuRootsContainer.childNodes[j], 'menu-root'))
						menuRoots.push(menuRootsContainer.childNodes[j]);
				break;
			}
		return { menu: menuRootsContainer, menuRoots };
	}

	let eventsMap = new Map();

	function setEventCallbackForElement(element, event, eventClass, callback, removeExisting) {
		let eventProxy = event + (eventClass ? '.' + eventClass : '');
		if (eventsMap.has(element)) {
			if (removeExisting && eventsMap.get(element).has(eventProxy)) {
				for (let callback of eventsMap.get(element).get(eventProxy))
					element.removeEventListener(event, callback);
				eventsMap.get(element).set(eventProxy, []);
			}
		} else {
			eventsMap.set(element, new Map());
		}
		if (!eventsMap.get(element).has(eventProxy))
			eventsMap.get(element).set(eventProxy, []);
		eventsMap.get(element).get(eventProxy).push(callback);
		element.addEventListener(event, callback);
	}

	function setMenuRootEvents({
		menuRootElement,
		openEvent = 'mouseenter', closeEvent = 'mouseleave', optionEvent = 'click', globalCloseEvent = 'click',
		openClass = 'open',
		closeOnOptionEvent = true, allowMenuRootOption = false,
		openCloseDelayTimeout = 50,
		singleOpen = true
	} = {}) {
		if (!menuRootElement && !(menuRootElement = this))
			return;

		let menuRootPhases = { openingOrOpened: 1, closingOrClosed: 2 }, openDelayTimeoutId, closeDelayTimeoutId, globalCloseOnOpenEvent = 'global-js-menu-close';

		let closeRecursiveHandler = (root) => {
			removeClass.call(root, openClass);
			root.removeAttribute('data-menu-class');
			root.menuRootPhase = menuRootPhases.closingOrClosed;
			let { menu, menuRoots } = getMenuAndMenuRoots(root);
			if (!menu || !menuRoots || !menuRoots.length)
				return;
			for (let menuRoot of menuRoots)
				closeRecursiveHandler(menuRoot);
		};

		if (hasClass.call(menuRootElement, 'menu-root.!menu-item')) {
			if (openEvent === 'mouseover')
				openEvent = 'mouseenter';

			if (closeEvent === 'mouseout')
				closeEvent = 'mouseleave';

			if (typeof(optionEvent) === 'string') {
				let optionHandler = (e) => {
					e.preventDefault();
					e.returnValue = false;
					let receiver = document.elementFromPoint(e.clientX, e.clientY);
					if (!receiver)
						return false;
					while (!hasClass.call(receiver, 'menu-root menu-item'))
						receiver = receiver.parentNode;
					if (!hasClass.call(receiver, 'menu-item') ||
							(!allowMenuRootOption && hasClass.call(receiver, 'menu-root')) ||
							((optionEvent === openEvent || optionEvent === closeEvent) && hasClass.call(receiver, 'menu-root')))
						return false;
					e.stopPropagation();
					let
						optionEventDataAttr = receiver.getAttribute('data-option-event') || menuRootElement.getAttribute('data-option-event') || 'menu-option',
						optionDataDataAttr = receiver.getAttribute('data-option-data');
					if (!optionEventDataAttr)
						return false;
					if (closeOnOptionEvent) {
						let closeTarget = hasClass.call(receiver, 'menu-root') ? receiver : receiver.parentNode.parentNode;
						while (hasClass.call(closeTarget, 'menu-root.menu-item')) {
							let
								dispatchedCloseEvent = document.createEvent('CustomEvent'),
								closeTargetMetrics = getElementMetrics(closeTarget);
							dispatchedCloseEvent.initCustomEvent(closeEvent, true, true, undefined);
							dispatchedCloseEvent.clientX = closeTargetMetrics.x;
							dispatchedCloseEvent.clientY = closeTargetMetrics.y;
							closeTarget.dispatchEvent(dispatchedCloseEvent);
							closeTarget = closeTarget.parentNode.parentNode;
						}
					}
					let dispatchedEvent = document.createEvent('CustomEvent');
					dispatchedEvent.initCustomEvent(optionEventDataAttr, true, true, undefined);
					dispatchedEvent.optionInfo = dispatchedEvent.optionInfo || {};
					dispatchedEvent.optionInfo.target = receiver;
					if (optionDataDataAttr)
						dispatchedEvent.optionInfo.data = optionDataDataAttr;
					document.dispatchEvent(dispatchedEvent);
					return false;
				};

				setEventCallbackForElement(menuRootElement, optionEvent, 'option', optionHandler, true);
			}

			let { menu, menuRoots } = getMenuAndMenuRoots(menuRootElement);

			let closeRootHandler = (e) => {
				for (let menuRoot of menuRoots)
					closeRecursiveHandler(menuRoot);
			};

			setEventCallbackForElement(menuRootElement, 'close', 'close', closeRootHandler, true);

			if (singleOpen) {
				let globalCloseOnOpenHandler = (e) => {
					e.preventDefault();
					e.returnValue = false;
					e.stopPropagation();
					if (!e.globalCloseInfo || !e.globalCloseInfo.exceptTarget || e.globalCloseInfo.exceptTarget === menuRootElement)
						return false;
					let dispatchedEvent = document.createEvent('CustomEvent');
					dispatchedEvent.initCustomEvent('close', true, true, undefined);
					menuRootElement.dispatchEvent(dispatchedEvent);
					return false;
				};

				setEventCallbackForElement(document, globalCloseOnOpenEvent, 'global-close', globalCloseOnOpenHandler, false);
			}

			if (globalCloseEvent)
				setEventCallbackForElement(document, globalCloseEvent, 'global-close', closeRootHandler, false);

			let enterEventAttr = menuRootElement.getAttribute('data-enter-event');

			if (enterEventAttr) {
				let menuEnterHandler = (e) => {
					e.preventDefault();
					e.returnValue = false;
					e.stopPropagation();
					let dispatchedEvent = document.createEvent('CustomEvent');
					dispatchedEvent.initCustomEvent(enterEventAttr, true, true, undefined);
					dispatchedEvent.enterInfo = dispatchedEvent.enterInfo || {};
					dispatchedEvent.enterInfo.target = menuRootElement;
					document.dispatchEvent(dispatchedEvent);
					return false;
				};

				setEventCallbackForElement(menuRootElement, 'mouseenter', 'enter', menuEnterHandler, true);
			}

			menuRoots.forEach((mr) => setMenuRootEvents({
				menuRootElement: mr,
				openEvent, closeEvent, optionEvent, globalCloseEvent,
				openClass,
				closeOnOptionEvent, allowMenuRootOption,
				openCloseDelayTimeout,
				singleOpen
			}));

			return;
		}

		let openHandler = (e) => {
			e.preventDefault();
			e.returnValue = false;

			let receiver = document.elementFromPoint(e.clientX, e.clientY);

			if (!receiver)
				return false;

			while (!hasClass.call(receiver, 'menu-root menu-item'))
				receiver = receiver.parentNode;

			if ((openEvent === closeEvent || openEvent === optionEvent) &&
					(!hasClass.call(receiver, 'menu-root') || receiver.menuRootPhase === menuRootPhases.openingOrOpened))
				return false;

			e.stopPropagation();

			let { menu, menuRoots } = getMenuAndMenuRoots(receiver);

			if (!menu)
				return false;

			if (!e.forceOpenHandler) {
				clearTimeout(closeDelayTimeoutId);

				if (singleOpen) {
					let dispatchedEvent = document.createEvent('CustomEvent');
					dispatchedEvent.initCustomEvent(globalCloseOnOpenEvent, true, true, undefined);
					dispatchedEvent.globalCloseInfo = dispatchedEvent.globalCloseInfo || {};
					dispatchedEvent.globalCloseInfo.exceptTarget = menuRootElement;
					document.dispatchEvent(dispatchedEvent);
				}

				let closeHandler = (e) => {
					e.preventDefault();
					e.returnValue = false;
					if (closeEvent === openEvent || closeEvent === optionEvent) {
						if (receiver.menuRootPhase === menuRootPhases.closingOrClosed)
							return false;
						let eventReceiver = document.elementFromPoint(e.clientX, e.clientY);
						if (!eventReceiver)
							return false;
						while (eventReceiver && !hasClass.call(eventReceiver, 'menu-root menu-item'))
							eventReceiver = eventReceiver.parentNode;
						if (!eventReceiver || !hasClass.call(eventReceiver, 'menu-root'))
							return false;
					}
					e.stopPropagation();
					clearTimeout(openDelayTimeoutId);
					clearTimeout(closeDelayTimeoutId);
					closeDelayTimeoutId = setTimeout(() => closeRecursiveHandler(receiver), openCloseDelayTimeout);
					return false;
				};

				setEventCallbackForElement(receiver, closeEvent, 'close', closeHandler, true);

				e.forceOpenHandler = true;

				clearTimeout(openDelayTimeoutId);
				openDelayTimeoutId = setTimeout(() => {
					openHandler(e);
				}, openCloseDelayTimeout);

				return false;
			}

			if (openEvent === closeEvent) {
				let parentMenuRoot = receiver.parentNode.parentNode;
				if (hasClass.call(parentMenuRoot, 'menu-root')) {
					let { menu, menuRoots } = getMenuAndMenuRoots(parentMenuRoot);
					for (let menuRoot of menuRoots)
						if (menuRoot !== receiver)
							closeRecursiveHandler(menuRoot);
				}
			}

			receiver.menuRootPhase = menuRootPhases.openingOrOpened;

			menuRoots.forEach((mr) => setMenuRootEvents({
				menuRootElement: mr,
				openEvent, closeEvent, optionEvent, globalCloseEvent,
				openClass,
				closeOnOptionEvent, allowMenuRootOption,
				openCloseDelayTimeout,
				singleOpen
			}));

			let
				classAttr = getClassSpec(getClassSet(menu.getAttribute('class'))),
				classDataAttr = menu.getAttribute('data-class'),
				dirSpec = getClassSet(classDataAttr || classAttr),
				forceDirClass = dirSpec.has('force-dir-class'),
				windowMetrics = getWindowMetrics(),
				menuMetrics,
				dirClass;

			if (forceDirClass) {
				addClass.call(receiver, 'open');
				receiver.setAttribute('data-menu-class', classAttr);
				return false;
			}

			if (classDataAttr) {
				menu.removeAttribute('data-class');
				menu.setAttribute('class', classDataAttr);
				classAttr = classDataAttr;
				dirSpec = getClassSet(classDataAttr);
			}

			let verticalDiffBest = windowMetrics.h, horizontalDiffBest = windowMetrics.w;

			for (let metricsFixPhase = 1; metricsFixPhase <= 2; metricsFixPhase++) {
				/* IF FIRST TIME IS NOT SATISFACTORY REVERT CHANGES AS NECESSARY */

				menuMetrics = getElementMetrics(menu);

				let verticalDiff, horizontalDiff;

				if (dirSpec.has('menu-under') || dirSpec.has('menu-top')) {
					verticalDiff = Math.max(menuMetrics.vyh, windowMetrics.vyh) - Math.min(menuMetrics.vyh, windowMetrics.vyh);
					if (menuMetrics.vyh > windowMetrics.vyh && (metricsFixPhase === 1 || verticalDiff > verticalDiffBest)) {
						verticalDiffBest = verticalDiff;
						if (dirSpec.delete('menu-under'))
							dirSpec.add('menu-above');
						else if (dirSpec.delete('menu-top'))
							dirSpec.add('menu-bottom');
					}
				} else if (dirSpec.has('menu-above') || dirSpec.has('menu-bottom')) {
					verticalDiff = Math.max(menuMetrics.vy, windowMetrics.vy) - Math.min(menuMetrics.vy, windowMetrics.vy);
					if (menuMetrics.vy < windowMetrics.vy && (metricsFixPhase === 1 || verticalDiff > verticalDiffBest)) {
						verticalDiffBest = verticalDiff;
						if (dirSpec.delete('menu-above'))
							dirSpec.add('menu-under');
						else if (dirSpec.delete('menu-bottom'))
							dirSpec.add('menu-top');
					}
				}

				if (dirSpec.has('menu-right')) {
					horizontalDiff = Math.max(menuMetrics.vxw, windowMetrics.vxw) - Math.min(menuMetrics.vxw, windowMetrics.vxw);
					if (menuMetrics.vxw > windowMetrics.vxw && (metricsFixPhase === 1 || horizontalDiff > horizontalDiffBest)) {
						horizontalDiffBest = horizontalDiff;
						dirSpec.delete('menu-right');
						dirSpec.add('menu-left');
					}
				} else if (dirSpec.has('menu-left')) {
					horizontalDiff = Math.max(menuMetrics.vx, windowMetrics.vx) - Math.min(menuMetrics.vx, windowMetrics.vx);
					if (menuMetrics.vx < windowMetrics.vx && (metricsFixPhase === 1 || horizontalDiff > horizontalDiffBest)) {
						horizontalDiffBest = horizontalDiff;
						dirSpec.delete('menu-left');
						dirSpec.add('menu-right');
					}
				}

				dirClass = getClassSpec(dirSpec);

				if (dirClass !== classAttr) {
					if (metricsFixPhase === 1) {
						menu.setAttribute('data-class', classAttr);
						classAttr = dirClass;
					} else {
						/* HERE WE REVERT BACK TO THE ORIGINALS BECAUSE THE FIX FAILED */
						menu.removeAttribute('data-class');
					}

					/* IF metricsFixPhase === 1 THIS IS A CHANGED CLASS ELSE THIS IS THE ORIGINAL CLASS */
					menu.setAttribute('class', dirClass);
				}
			}

			addClass.call(receiver, 'open');

			receiver.setAttribute('data-menu-class', dirClass);

			return false;
		};

		setEventCallbackForElement(menuRootElement, openEvent, 'open', openHandler, true);
	}

	HTMLElement.prototype.setMenuRootEvents = setMenuRootEvents;
})();
