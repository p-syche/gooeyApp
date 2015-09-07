angular.module('starter.directives', [])

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
      		innerElement = jqLite('<div class="tab-nav tabs"><gooey-button>GOOEY</gooey-button>');

      innerElement.append(tElement.contents());

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
      var tabNavTemplate = '<ion-tab-nav' +
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
        '></ion-tab-nav>';

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
        tabsCtrl.$tabsElement.append($compile(tabNavElement)($scope));


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
				'<i class="ion-plus-round"></i>' +
			'</button>',
		link: function (scope, elem, attrs) {

			$timeout(function () {
				var menuItemNum = elem.parent().find('a').length,
					menuItem = elem.parent().find('a'),
					buttonIcon = elem.find('i'),
					angle=120,
					distance=90,
					startingAngle=180+(-angle/2)
					slice=angle/(menuItemNum-1);

			TweenMax.globalTimeScale(0.8);

			angular.forEach(menuItem, function (item, i) {
				var angle=startingAngle+(slice*i);
				angular.element(item).css({
					transform:"rotate("+(angle)+"deg)"
				});
				angular.element(item.children[0]).css({
					transform:"rotate("+(-angle)+"deg)"
				});
			});

			var on=false;
		
			$ionicGesture.on('touch', function () {
				TweenMax.to(buttonIcon,0.1,{
					scale:0.65
				})
			}, elem);
			

			$ionicGesture.on('release', function () {
				TweenMax.to(buttonIcon,0.1,{
					scale:1
				})
			}, elem);

			

			


			}, 10);

	// var menuItemNum=$(".menu-item").length;
	// var angle=120;
	// var distance=90;
	// var startingAngle=180+(-angle/2);
	// var slice=angle/(menuItemNum-1);
	// TweenMax.globalTimeScale(0.8);
		}
	}
});

// .directive('gooeyTabNav', [function() {
//   return {
//     restrict: 'E',
//     replace: true,
//     require: ['^gooeyTabs', '^gooeyTab'],
//     template:
//     '<a ng-class="{\'tab-item-active\': isTabActive(), \'has-badge\':badge, \'tab-hidden\':isHidden()}" ' +
//       ' ng-disabled="disabled()" class="tab-item">' +
//       '<span class="badge {{badgeStyle}}" ng-if="badge">{{badge}}</span>' +
//       '<i class="icon {{getIconOn()}}" ng-if="getIconOn() && isTabActive()"></i>' +
//       '<i class="icon {{getIconOff()}}" ng-if="getIconOff() && !isTabActive()"></i>' +
//     '</a>',
//     scope: {
//       title: '@',
//       icon: '@',
//       iconOn: '@',
//       iconOff: '@',
//       badge: '=',
//       hidden: '@',
//       disabled: '&',
//       badgeStyle: '@',
//       'class': '@'
//     },
//     compile: function () {
//     	console.log('compiles now')
//     },
//     // link: function($scope, $element, $attrs, ctrls) {
//     // 	console.log('links now')
//     //   var tabsCtrl = ctrls[0],
//     //     tabCtrl = ctrls[1];

//     //   //Remove title attribute so browser-tooltip does not apear
//     //   $element[0].removeAttribute('title');

//     //   $scope.selectTab = function(e) {
//     //     e.preventDefault();
//     //     tabsCtrl.select(tabCtrl.$scope, true);
//     //   };
//     //   if (!$attrs.ngClick) {
//     //     $element.on('click', function(event) {
//     //       $scope.$apply(function() {
//     //         $scope.selectTab(event);
//     //       });
//     //     });
//     //   }

//     //   $scope.isHidden = function() {
//     //     if ($attrs.hidden === 'true' || $attrs.hidden === true) return true;
//     //     return false;
//     //   };

//     //   $scope.getIconOn = function() {
//     //     return $scope.iconOn || $scope.icon;
//     //   };
//     //   $scope.getIconOff = function() {
//     //     return $scope.iconOff || $scope.icon;
//     //   };

//     //   $scope.isTabActive = function() {
//     //     return tabsCtrl.selectedTab() === tabCtrl.$scope;
//     //   };
//     // }
//   };
// }]);