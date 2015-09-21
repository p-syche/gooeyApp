angular.module('gooeyApp.directives', [])

.directive('gooeyTabs', [
  '$ionicTabsDelegate',
  '$ionicConfig',
function($ionicTabsDelegate, $ionicConfig) {
  return {
    restrict: 'E',
    scope: true,
    controller: '$ionicTabs',
    compile: function(tElement) {
      //We cannot use regular transclude here because it breaks element.data()
      //inheritance on compile
    	var jqLite = angular.element,
      		innerElement = jqLite('<div class="tab-nav tabs">');

      innerElement.append(tElement.contents());
      innerElement.append('<gooey-button>GOOEY</gooey-button>');

      tElement.append(innerElement)
              .addClass('tabs-' + $ionicConfig.tabs.position() + ' tabs-' + $ionicConfig.tabs.style());

      return { pre: prelink, post: postLink };
      function prelink($scope, $element, $attr, tabsCtrl) {
        var deregisterInstance = $ionicTabsDelegate._registerInstance(
          tabsCtrl, $attr.delegateHandle, tabsCtrl.hasActiveScope
        );

        tabsCtrl.$scope = $scope;
        tabsCtrl.$element = $element;
        tabsCtrl.$tabsElement = jqLite($element[0].querySelector('.tabs'));
        tabsCtrl.$tabsElement.append('<ul class="menu-items"></ul>');
        tabsCtrl.$tabNavList = jqLite($element[0].querySelector('.menu-items'));

        $scope.$watch(function() { return $element[0].className; }, function(value) {
          var isTabsTop = value.indexOf('tabs-top') !== -1;
          var isHidden = value.indexOf('tabs-item-hide') !== -1;
          $scope.$hasTabs = !isTabsTop && !isHidden;
          $scope.$hasTabsTop = isTabsTop && !isHidden;
          $scope.$emit('$ionicTabs.top', $scope.$hasTabsTop);
        });

        function emitLifecycleEvent(ev, data) {
          ev.stopPropagation();
          var previousSelectedTab = tabsCtrl.previousSelectedTab();
          if (previousSelectedTab) {
            previousSelectedTab.$broadcast(ev.name.replace('NavView', 'Tabs'), data);
          }
        }

        $scope.$on('$ionicNavView.beforeLeave', emitLifecycleEvent);
        $scope.$on('$ionicNavView.afterLeave', emitLifecycleEvent);
        $scope.$on('$ionicNavView.leave', emitLifecycleEvent);

        $scope.$on('$destroy', function() {
          // variable to inform child tabs that they're all being blown away
          // used so that while destorying an individual tab, each one
          // doesn't select the next tab as the active one, which causes unnecessary
          // loading of tab views when each will eventually all go away anyway
          $scope.$tabsDestroy = true;
          deregisterInstance();
          tabsCtrl.$tabsElement = tabsCtrl.$element = tabsCtrl.$scope = innerElement = null;
          delete $scope.$hasTabs;
          delete $scope.$hasTabsTop;
        });
      }

      function postLink($scope, $element, $attr, tabsCtrl) {
        if (!tabsCtrl.selectedTab()) {
          // all the tabs have been added
          // but one hasn't been selected yet
          tabsCtrl.select(0);
        }
      }
    }
  };
}])

.directive('gooeyTabNav', [function() {
  return {
    restrict: 'E',
    replace: true,
    require: ['^ionTabs', '^ionTab'],
    template:
    '<li ng-class="{\'tab-item-active\': isTabActive(), \'has-badge\':badge, \'tab-hidden\':isHidden()}" ' +
      ' ng-disabled="disabled()" class="menu-item">' +
  		'<button class="menu-item-button">' +
  			'<i class="icon {{getIconOn()}}" ng-if="getIconOn() && isTabActive()"></i>' +
  			'<i class="icon {{getIconOff()}}" ng-if="getIconOff() && !isTabActive()"></i>' +
  		'</button>' +
  		'<div class="menu-item-bounce"></div>' +
  	'</li>',
    scope: {
      title: '@',
      icon: '@',
      iconOn: '@',
      iconOff: '@',
      badge: '=',
      hidden: '@',
      disabled: '&',
      badgeStyle: '@',
      'class': '@'
    },
    link: function($scope, $element, $attrs, ctrls) {
      var tabsCtrl = ctrls[0],
        tabCtrl = ctrls[1];

      //Remove title attribute so browser-tooltip does not apear
      $element[0].removeAttribute('title');

      $scope.selectTab = function(e) {
        e.preventDefault();
        tabsCtrl.select(tabCtrl.$scope, true);
      };
      if (!$attrs.ngClick) {
        $element.on('click', function(event) {
          $scope.$apply(function() {
            $scope.selectTab(event);
          });
        });
      }

      $scope.isHidden = function() {
        if ($attrs.hidden === 'true' || $attrs.hidden === true) return true;
        return false;
      };

      $scope.getIconOn = function() {
        return $scope.iconOn || $scope.icon;
      };
      $scope.getIconOff = function() {
        return $scope.iconOff || $scope.icon;
      };

      $scope.isTabActive = function() {
        return tabsCtrl.selectedTab() === tabCtrl.$scope;
      };
    }
  };
}])

.directive('gooeyTab', [
  '$compile',
  '$ionicConfig',
  '$ionicBind',
  '$ionicViewSwitcher',
function($compile, $ionicConfig, $ionicBind, $ionicViewSwitcher) {

  //Returns ' key="value"' if value exists
  function attrStr(k, v) {
    return angular.isDefined(v) ? ' ' + k + '="' + v + '"' : '';
  }
  return {
    restrict: 'E',
    require: ['^gooeyTabs', 'gooeyTab'],
    controller: '$ionicTab',
    scope: true,
    compile: function(element, attr) {

    	var jqLite = angular.element;

      //We create the tabNavTemplate in the compile phase so that the
      //attributes we pass down won't be interpolated yet - we want
      //to pass down the 'raw' versions of the attributes
      var tabNavTemplate = '<gooey-tab-nav' +
        attrStr('ng-click', attr.ngClick) +
        attrStr('title', attr.title) +
        attrStr('icon', attr.icon) +
        attrStr('icon-on', attr.iconOn) +
        attrStr('icon-off', attr.iconOff) +
        attrStr('badge', attr.badge) +
        attrStr('badge-style', attr.badgeStyle) +
        attrStr('hidden', attr.hidden) +
        attrStr('disabled', attr.disabled) +
        attrStr('class', attr['class']) +
        '></gooey-tab-nav>';

      //Remove the contents of the element so we can compile them later, if tab is selected
      var tabContentEle = document.createElement('div');
      for (var x = 0; x < element[0].children.length; x++) {
        tabContentEle.appendChild(element[0].children[x].cloneNode(true));
      }
      var childElementCount = tabContentEle.childElementCount;
      element.empty();

      var navViewName, isNavView;
      if (childElementCount) {
        if (tabContentEle.children[0].tagName === 'ION-NAV-VIEW') {
          // get the name if it's a nav-view
          navViewName = tabContentEle.children[0].getAttribute('name');
          tabContentEle.children[0].classList.add('view-container');
          isNavView = true;
        }
        if (childElementCount === 1) {
          // make the 1 child element the primary tab content container
          tabContentEle = tabContentEle.children[0];
        }
        if (!isNavView) tabContentEle.classList.add('pane');
        tabContentEle.classList.add('tab-content');
      }

      return function link($scope, $element, $attr, ctrls) {
        var childScope;
        var childElement;
        var tabsCtrl = ctrls[0];
        var tabCtrl = ctrls[1];
        var isTabContentAttached = false;
        $scope.$tabSelected = false;

        $ionicBind($scope, $attr, {
          onSelect: '&',
          onDeselect: '&',
          title: '@',
          uiSref: '@',
          href: '@'
        });

        tabsCtrl.add($scope);
        $scope.$on('$destroy', function() {
          if (!$scope.$tabsDestroy) {
            // if the containing ionTabs directive is being destroyed
            // then don't bother going through the controllers remove
            // method, since remove will reset the active tab as each tab
            // is being destroyed, causing unnecessary view loads and transitions
            tabsCtrl.remove($scope);
          }
          tabNavElement.isolateScope().$destroy();
          tabNavElement.remove();
          tabNavElement = tabContentEle = childElement = null;
        });

        //Remove title attribute so browser-tooltip does not apear
        $element[0].removeAttribute('title');

        if (navViewName) {
          tabCtrl.navViewName = $scope.navViewName = navViewName;
        }
        $scope.$on('$stateChangeSuccess', selectIfMatchesState);
        selectIfMatchesState();
        function selectIfMatchesState() {
          if (tabCtrl.tabMatchesState()) {
            tabsCtrl.select($scope, false);
          }
        }

        var tabNavElement = jqLite(tabNavTemplate);
        tabNavElement.data('$ionTabsController', tabsCtrl);
        tabNavElement.data('$ionTabController', tabCtrl);
        tabsCtrl.$tabNavList.append($compile(tabNavElement)($scope));

        function tabSelected(isSelected) {
          if (isSelected && childElementCount) {
            // this tab is being selected

            // check if the tab is already in the DOM
            // only do this if the tab has child elements
            if (!isTabContentAttached) {
              // tab should be selected and is NOT in the DOM
              // create a new scope and append it
              childScope = $scope.$new();
              childElement = jqLite(tabContentEle);
              $ionicViewSwitcher.viewEleIsActive(childElement, true);
              tabsCtrl.$element.append(childElement);
              $compile(childElement)(childScope);
              isTabContentAttached = true;
            }

            // remove the hide class so the tabs content shows up
            $ionicViewSwitcher.viewEleIsActive(childElement, true);

          } else if (isTabContentAttached && childElement) {
            // this tab should NOT be selected, and it is already in the DOM

            if ($ionicConfig.views.maxCache() > 0) {
              // keep the tabs in the DOM, only css hide it
              $ionicViewSwitcher.viewEleIsActive(childElement, false);

            } else {
              // do not keep tabs in the DOM
              destroyTab();
            }

          }
        }

        function destroyTab() {
          childScope && childScope.$destroy();
          isTabContentAttached && childElement && childElement.remove();
          tabContentEle.innerHTML = '';
          isTabContentAttached = childScope = childElement = null;
        }

        $scope.$watch('$tabSelected', tabSelected);

        $scope.$on('$ionicView.afterEnter', function() {
          $ionicViewSwitcher.viewEleIsActive(childElement, $scope.$tabSelected);
        });

        $scope.$on('$ionicView.clearCache', function() {
          if (!$scope.$tabSelected) {
            destroyTab();
          }
        });

      };
    }
  };
}])

.directive('gooeyButton', function ($timeout, $ionicGesture) {
	return {
		template: 
			'<button class="menu-toggle-button">' +
				'<i class="menu-toggle-icon ion-plus-round"></i>' +
			'</button>',
		link: function (scope, elem, attrs) {

			$timeout(function () {

        var pane = angular.element(document.querySelector('.pane'));

        function isEquivalent(a, b) {
          // Create arrays of property names
          var aProps = Object.getOwnPropertyNames(a);
          var bProps = Object.getOwnPropertyNames(b);

          // If number of properties is different,
          // objects are not equivalent
          if (aProps.length != bProps.length) {
              return false;
          }

          for (var i = 0; i < aProps.length; i++) {
              var propName = aProps[i];

              // If values of same property are not equal,
              // objects are not equivalent
              if (a[propName] !== b[propName]) {
                  return false;
              }
          }

          // If we made it this far, objects
          // are considered equivalent
          return true;
        }



				var menuItemNum = elem.parent().find('li').length,
					menuItem = elem.parent().find('li'),
					buttonIcon = elem.find('i'),
					angle=120,
					distance=90,
					startingAngle=180+(-angle/2),
					slice=angle/(menuItemNum-1),
          on=false;

				TweenMax.globalTimeScale(0.8);

        $ionicGesture.on('touch', function (event) {
          // alert('touched the pane')
          if (isEquivalent(angular.element(event.target), buttonIcon)) {
            TweenMax.to(buttonIcon,0.1,{
               scale:0.65
             });

            TweenMax.to(buttonIcon,0.4,{
              rotation:on?45:0,
              ease:Quint.easeInOut,
              force3D:true
            });

            pressHandler();

          } else if (on === true) {
            on=false;
            TweenMax.to(buttonIcon,0.4,{
              rotation:on?45:0,
              ease:Quint.easeInOut,
              force3D:true
            });
            closeMenu();
          } 
        }, pane);

        $ionicGesture.on('release', function (event) {
          TweenMax.to(buttonIcon,0.1,{
            scale:1
          })
        }, elem);

				angular.forEach(menuItem, function (item, i) {
					var angle=startingAngle+(slice*i),
						itemIcon = angular.element(item).find('i');
            
					angular.element(item).css({
						'transform':"rotate("+(angle)+"deg)",
            '-webkit-transform':"rotate("+(angle)+"deg)",
            '-ms-transform':"rotate("+(angle)+"deg)"
					});
					angular.element(item.children[0]).css({
						'transform':"rotate("+(-angle)+"deg)",
            '-webkit-transform':"rotate("+(-angle)+"deg)",
            '-ms-transform':"rotate("+(-angle)+"deg)"
					});

				});
								
				function pressHandler(){
					on=!on;

					TweenMax.to(buttonIcon,0.4,{
						rotation:on?45:0,
						ease:Quint.easeInOut,
						force3D:true
					});

					on?openMenu():closeMenu();
					
				};

				function openMenu () {
          angular.forEach(menuItem, function (item, i) {
						var delay = i*0.08,
							bounce = angular.element(item).find('div'),
							button = angular.element(item).find('button');

						TweenMax.fromTo(bounce,0.2,{
							transformOrigin:"50% 50%"
						},{
							delay:delay,
							scaleX:0.8,
							scaleY:1.2,
							force3D:true,
							ease:Quad.easeInOut,
							onComplete:function(){
								TweenMax.to(bounce,0.15,{
									// scaleX:1.2,
									scaleY:0.7,
									force3D:true,
									ease:Quad.easeInOut,
									onComplete:function(){
										TweenMax.to(bounce,3,{
											// scaleX:1,
											scaleY:0.8,
											force3D:true,
											ease:Elastic.easeOut,
											easeParams:[1.1,0.12]
										})
									}
								})
							}
						});

						TweenMax.to(button,0.5,{
							delay:delay,
							y:distance,
							force3D:true,
							ease:Quint.easeInOut
						});

					});

			
				};

				function closeMenu () {
          angular.forEach(menuItem, function (item, i) {
						var delay=i*0.08,
							bounce = angular.element(item).find('div'),
							button = angular.element(item).find('button');

						TweenMax.fromTo(bounce,0.2,{
							transformOrigin:"50% 50%"
						},{
							delay:delay,
							scaleX:1,
							scaleY:0.8,
							force3D:true,
							ease:Quad.easeInOut,
							onComplete:function(){
								TweenMax.to(bounce,0.15,{
									// scaleX:1.2,
									scaleY:1.2,
									force3D:true,
									ease:Quad.easeInOut,
									onComplete:function(){
										TweenMax.to(bounce,3,{
											// scaleX:1,
											scaleY:1,
											force3D:true,
											ease:Elastic.easeOut,
											easeParams:[1.1,0.12]
										})
									}
								})
							}
						});

						TweenMax.to(button,0.3,{
							delay:delay,
							y:0,
							force3D:true,
							ease:Quint.easeIn
						});
					});
				};
			}, 10);
		}
	}
});
