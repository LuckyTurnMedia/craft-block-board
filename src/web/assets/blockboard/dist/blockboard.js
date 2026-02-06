// Outputs a preview modal and inline previews for Matrix blocks that have already been added to the entry

(function ($, Craft, Garnish) {
  "use strict";

  if (!Craft || !Craft.cp || !Garnish || !$) {
    return;
  }

  var configuredFieldHandles = window.blockBoardPreviewFields;
  var FIELD_HANDLES =
    Array.isArray(configuredFieldHandles) && configuredFieldHandles.length
      ? configuredFieldHandles
      : ["contentBuilder"];
  var FIELD_SELECTORS = FIELD_HANDLES.map(function (fieldHandle) {
    var handle = normalizeHandle(fieldHandle);
    return handle ? "#fields-" + handle + "-field" : "";
  }).filter(function (selector) {
    return !!selector;
  });
  var PREVIEW_BTN_CLASS = "blockboard-preview-all-btn";
  var configuredPreviewImageLocations = window.blockBoardPreviewImageLocations;
  var PREVIEW_IMAGE_FALLBACK = "default.png";
  var INIT_ATTEMPTS = 20;
  var INIT_DELAY_MS = 150;
  var INLINE_PREVIEW_FIELD_CLASS = "blockboard-inline-preview-field";
  var INLINE_PREVIEW_IMAGE_CLASS = "blockboard-inline-preview-image";

  function normalizeHandle(handle) {
    return handle ? String(handle).trim() : "";
  }

  function normalizeImageBase(base) {
    var safeBase =
      typeof base === "string" ? base.trim().replace(/^\/+|\/+$/g, "") : "";
    return "/" + (safeBase || "matrixblockpreview/previews") + "/";
  }

  function imageBaseForField(fieldHandle) {
    var map =
      configuredPreviewImageLocations &&
      typeof configuredPreviewImageLocations === "object"
        ? configuredPreviewImageLocations
        : {};
    return normalizeImageBase(map[fieldHandle] || map["*"]);
  }

  function imageUrlForHandle(handle, fieldHandle) {
    var imageBase = imageBaseForField(fieldHandle);
    var safeHandle = normalizeHandle(handle);
    if (!safeHandle) {
      return imageBase + PREVIEW_IMAGE_FALLBACK;
    }

    return imageBase + safeHandle + ".png";
  }

  function buildEntryTypeIdMap(matrix) {
    var map = {};
    var entryTypes = Array.isArray(matrix.entryTypes) ? matrix.entryTypes : [];
    entryTypes.forEach(function (entryType) {
      if (entryType && entryType.id && entryType.handle) {
        map[entryType.id] = entryType.handle;
      }
    });
    return map;
  }

  function buildEntryTypeNameMap(matrix) {
    var map = {};
    var entryTypes = Array.isArray(matrix.entryTypes) ? matrix.entryTypes : [];
    entryTypes.forEach(function (entryType) {
      if (entryType && entryType.handle) {
        map[entryType.handle] = entryType.name || entryType.handle;
      }
    });
    return map;
  }

  function getHandleForEntry($entry, entryTypesById) {
    var handle = normalizeHandle($entry.data("type"));
    if (handle) {
      return handle;
    }
    var typeId = $entry.data("type-id");
    if (typeId && entryTypesById[typeId]) {
      return normalizeHandle(entryTypesById[typeId]);
    }
    return "";
  }

  function addInlinePreviewFields(matrix, fieldHandle) {
    var $entriesContainer =
      matrix.$entriesContainer ||
      (matrix.$container && matrix.$container.children(".blocks"));
    if (!$entriesContainer || !$entriesContainer.length) {
      return;
    }

    var entryTypesById = buildEntryTypeIdMap(matrix);
    var entryTypeNames = buildEntryTypeNameMap(matrix);
    var fallbackUrl = imageBaseForField(fieldHandle) + PREVIEW_IMAGE_FALLBACK;

    function addPreviewField($entry) {
      if (!$entry || !$entry.length) {
        return;
      }
      if ($entry.find("." + INLINE_PREVIEW_FIELD_CLASS).length) {
        return;
      }
      var handle = getHandleForEntry($entry, entryTypesById);
      if (!handle) {
        return;
      }
      var blockName = entryTypeNames[handle] || handle || Craft.t("app", "Block");
      var $fields = $entry.children(".fields");
      if (!$fields.length) {
        return;
      }
      var $field = $('<div class="field"></div>');
      $field.addClass(INLINE_PREVIEW_FIELD_CLASS);
      var $heading = $('<div class="heading blockboard-inline-preview-heading"></div>');
      var $label = $("<label/>", {
        text: blockName + " " + Craft.t("app", "preview"),
      });
      var $input = $('<div class="input blockboard-inline-preview-input"></div>');
      var $image = $("<img/>", {
        class: INLINE_PREVIEW_IMAGE_CLASS,
        src: imageUrlForHandle(handle, fieldHandle),
        alt: "",
        loading: "lazy",
        "aria-hidden": "true",
      });
      $image.on("error", function () {
        if (this.src.indexOf(fallbackUrl) === -1) {
          this.src = fallbackUrl;
        }
      });
      $image.on("mouseenter", function (event) {
        var $preview = $("<img/>", {
          src: this.src,
          alt: "",
          "aria-hidden": "true",
        });
        $preview.addClass("blockboard-inline-preview-full");
        Garnish.$bod.append($preview);
        if (event) {
          var x = event.clientX + 12;
          var y = event.clientY + 12;
          $preview[0].style.left = x + "px";
          $preview[0].style.top = y + "px";
        }
        $image.data("fullPreview", $preview);
      });
      $image.on("mousemove", function (event) {
        var $preview = $image.data("fullPreview");
        if (!$preview || !$preview.length || !event) {
          return;
        }
        var x = event.clientX + 12;
        var y = event.clientY + 12;
        var maxX = window.innerWidth - $preview.outerWidth() - 12;
        var maxY = window.innerHeight - $preview.outerHeight() - 12;
        if (x > maxX) {
          x = Math.max(12, event.clientX - $preview.outerWidth() - 12);
        }
        if (y > maxY) {
          y = Math.max(12, event.clientY - $preview.outerHeight() - 12);
        }
        $preview[0].style.left = x + "px";
        $preview[0].style.top = y + "px";
      });
      $image.on("mouseleave", function () {
        var $preview = $image.data("fullPreview");
        if ($preview && $preview.length) {
          $preview.remove();
        }
        $image.removeData("fullPreview");
      });
      $heading.append($label);
      $input.append($image);
      $field.append($input, $heading);
      $fields.prepend($field);
    }

    $entriesContainer.children(".matrixblock").each(function () {
      addPreviewField($(this));
    });

    if (typeof matrix.on === "function") {
      matrix.on("entryAdded", function (event) {
        if (event && event.$entry) {
          addPreviewField(event.$entry);
        }
      });
    }
  }

  function buildGroupMap(matrix) {
    var map = {};
    var groups = Array.isArray(matrix.entryTypeGroups)
      ? matrix.entryTypeGroups
      : [];

    groups.forEach(function (group) {
      var id =
        group.id ||
        group.groupId ||
        group.uid ||
        group.handle ||
        group.name;
      var name = group.name || group.handle || group.id;
      if (id && name) {
        map[id] = name;
      }
    });

    return map;
  }

  function buildGroupMapFromMenu(matrix) {
    var map = {};
    var $container = matrix.$addEntryBtnContainer || matrix.$container;
    if (!$container || !$container.length) {
      return map;
    }

    $container.find('button[aria-controls][data-disclosure-trigger]').each(function () {
      var $trigger = $(this);
      var menuId = $trigger.attr("aria-controls");
      if (!menuId) {
        return;
      }

      var label = $trigger.find(".label").first().text().trim();
      if (!label) {
        label = $trigger.text().trim();
      }

      if (!label) {
        return;
      }

      var $menu = $("#" + menuId);
      if (!$menu.length) {
        return;
      }

      $menu.find("button[data-type]").each(function () {
        var $btn = $(this);
        var handle = normalizeHandle($btn.data("type"));
        if (handle) {
          map[handle] = label;
        }
      });
    });

    return map;
  }

  function getGroupLabel(entryType, groupMap, menuMap) {
    var label =
      entryType.groupName ||
      entryType.group ||
      entryType.groupHandle ||
      null;
    var groupId = entryType.groupId || entryType.entryTypeGroupId || null;

    if (!label && groupId && groupMap[groupId]) {
      label = groupMap[groupId];
    }

    if (!label) {
      var handle = normalizeHandle(entryType.handle);
      if (handle && menuMap[handle]) {
        label = menuMap[handle];
      }
    }

    return label || Craft.t("app", "Ungrouped");
  }

  function buildPreviewGrid(matrix, modal, fieldHandle) {
    var entryTypes = Array.isArray(matrix.entryTypes) ? matrix.entryTypes : [];
    var groupMap = buildGroupMap(matrix);
    var menuMap = buildGroupMapFromMenu(matrix);
    var groups = [];
    var seenGroups = {};
    var $grid = $('<div class="blockboard-preview-grid"></div>');

    entryTypes.forEach(function (entryType) {
      var handle = normalizeHandle(entryType.handle);
      var name = entryType.name || handle || Craft.t("app", "Block");
      var groupLabel = getGroupLabel(entryType, groupMap, menuMap);
      var groupKey = String(groupLabel).toLowerCase();
      if (!seenGroups[groupKey]) {
        seenGroups[groupKey] = true;
        groups.push(groupLabel);
      }
      var $item = $('<div class="blockboard-preview-item"></div>');
      $item.attr("data-name", String(name).toLowerCase());
      $item.attr("data-group", groupKey);
      var $imageWrap = $('<div class="blockboard-preview-image-wrap"></div>');
      var $image = $("<img/>", {
        src: imageUrlForHandle(handle, fieldHandle),
        alt: name,
        loading: "lazy",
        class: "blockboard-preview-image",
      });
      var $label = $("<div/>", {
        class: "blockboard-preview-label",
        text: name,
      });
      var $pill = $("<span/>", {
        class: "blockboard-preview-pill",
        text: groupLabel,
      });
      $pill.attr("data-group", groupKey);
      $label.append($pill);

      $image.on("error", function () {
        var fallback = imageBaseForField(fieldHandle) + PREVIEW_IMAGE_FALLBACK;
        if (this.src.indexOf(fallback) === -1) {
          this.src = fallback;
        }
      });

      $item.on("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        if (!handle) {
          return;
        }
        if ($item.hasClass("loading")) {
          return;
        }

        $item.addClass("loading");
        if (!$item.find(".blockboard-preview-item-spinner").length) {
          $item.append(
            $('<div class="spinner blockboard-preview-item-spinner" aria-hidden="true"></div>')
          );
        }

        matrix
          .addEntry(handle)
          .then(function () {
            if (modal) {
              modal.hide();
            }
          })
          .catch(function () {
            $item.removeClass("loading");
            $item.find(".blockboard-preview-item-spinner").remove();
          });
      });

      $pill.on("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (modal && modal.$container) {
          var targetGroup = $pill.attr("data-group");
          var $btn = modal.$container
            .find(".blockboard-preview-group-filter .btn")
            .filter(function () {
              return $(this).data("group") === targetGroup;
            })
            .first();
          if ($btn.length) {
            $btn.trigger("click");
          }
        }
      });

      $imageWrap.append($image);
      $item.append($imageWrap, $label);
      $grid.append($item);
    });

    return {
      $grid: $grid,
      groups: groups,
    };
  }

  function openPreviewModal(matrix, fieldHandle) {
    var $modal = $(
      '<div class="modal fitted blockboard-preview-modal" role="dialog" aria-modal="true"></div>'
    ).appendTo(Garnish.$bod);
    var $wrap = $('<div class="blockboard-preview-wrap"></div>').appendTo($modal);
    var $header = $('<div class="header blockboard-preview-header"></div>').appendTo(
      $wrap
    );
    var $body = $('<div class="body blockboard-preview-body"></div>').appendTo($wrap);
    var $footer = $('<div class="footer blockboard-preview-footer"></div>').appendTo(
      $wrap
    );
    var $buttons = $('<div class="buttons right blockboard-preview-buttons"></div>').appendTo(
      $footer
    );
    var $closeBtn = Craft.ui.createButton({
      class: "btn blockboard-preview-close-btn",
      label: Craft.t("app", "Close"),
    }).appendTo($buttons);

    var entryTypes = Array.isArray(matrix.entryTypes) ? matrix.entryTypes : [];
    var $title = $("<h2/>", {
      class: "blockboard-preview-title",
      text:
        Craft.t("app", "Block previews")
    });

    var modal = new Garnish.Modal($modal, {
      resizable: true,
    });

    var gridData = buildPreviewGrid(matrix, modal, fieldHandle);
    var $grid = gridData.$grid;
    var groups = gridData.groups;

    var $searchWrap = $('<div class="blockboard-preview-search-wrap"></div>');
    var $searchIcon = $(
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6" aria-hidden="true">' +
        '<path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />' +
      "</svg>"
    );
    $searchIcon.addClass("blockboard-preview-search-icon");
    var $search = $("<input/>", {
      type: "search",
      class: "text fullwidth blockboard-preview-search",
      placeholder: Craft.t("app", "Search blocks"),
    });
    $searchWrap.append($searchIcon, $search);
    var $groupFilter = null;
    if (groups.length > 1) {
      $groupFilter = $('<div class="blockboard-preview-group-filter btngroup"></div>');
      var $allBtn = Craft.ui.createButton({
        class: "btn dashed active",
        label: Craft.t("app", "All groups"),
      });
      $allBtn.attr("type", "button").data("group", "all");
      $groupFilter.append($allBtn);
      groups.forEach(function (groupLabel) {
        var $btn = Craft.ui.createButton({
          class: "btn dashed",
          label: groupLabel,
        });
        $btn
          .attr("type", "button")
          .data("group", String(groupLabel).toLowerCase());
        $groupFilter.append($btn);
      });
    }

    function applyFilters() {
      var query = String($search.val() || "").toLowerCase();
      var groupValue = "all";
      if ($groupFilter) {
        groupValue =
          $groupFilter.find(".btn.active").data("group") || "all";
      }

      $grid.find(".blockboard-preview-item").each(function () {
        var $item = $(this);
        var name = $item.attr("data-name") || "";
        var groupKey = $item.attr("data-group") || "";
        var matchesQuery = name.indexOf(query) !== -1;
        var matchesGroup =
          groupValue === "all" || groupKey === String(groupValue);
        $item.toggle(matchesQuery && matchesGroup);
      });
    }

    $search.on("input", applyFilters);
    if ($groupFilter) {
      $groupFilter.on("click", ".btn", function (event) {
        event.preventDefault();
        var $btn = $(this);
        $groupFilter.find(".btn").removeClass("active");
        $btn.addClass("active");
        applyFilters();
      });
    }

    if ($groupFilter) {
      $header.append($title, $groupFilter);
    } else {
      $header.append($title);
    }

    $header.append($searchWrap);
    $body.append($grid);

    $closeBtn.on("click", function (event) {
      event.preventDefault();
      modal.hide();
    });

    modal.on("hide", function () {
      $modal.remove();
    });
  }

  function addPreviewAllButton(matrix, fieldHandle) {
    var $container = matrix.$addEntryBtnContainer || matrix.$container;
    if (!$container || !$container.length) {
      return;
    }

    if ($container.find("." + PREVIEW_BTN_CLASS).length) {
      return;
    }

    var $btn = Craft.ui.createButton({
      class: "btn " + PREVIEW_BTN_CLASS,
      label: Craft.t("app", "Preview"),
    });

    var $icon = $(
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6" aria-hidden="true">' +
        '<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />' +
        '<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />' +
      "</svg>"
    );
    $icon.addClass("blockboard-preview-btn-icon");
    $btn.prepend($icon);

    $btn.attr("type", "button");

    $btn.on("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      openPreviewModal(matrix, fieldHandle);
    });

    $container.prepend($btn);
  }

  function getFieldHandleFromElement($field) {
    var id = String($field.attr("id") || "");
    var match = id.match(/^fields-(.+)-field$/);
    return match && match[1] ? match[1] : "";
  }

  function setupMatrixPreview(matrix, fieldHandle) {
    addPreviewAllButton(matrix, fieldHandle);
    addInlinePreviewFields(matrix, fieldHandle);
  }

  function init() {
    var $fields = $(FIELD_SELECTORS.join(", "));
    if (!$fields.length) {
      return true;
    }

    var allReady = true;
    $fields.each(function () {
      var $matrix = $(this).find(".matrix").first();
      if (!$matrix.length) {
        return;
      }

      var matrix = $matrix.data("matrix");
      if (!matrix) {
        allReady = false;
        return;
      }

      var fieldHandle = getFieldHandleFromElement($(this));
      setupMatrixPreview(matrix, fieldHandle);
    });

    return allReady;
  }

  Garnish.$doc.ready(function () {
    var attempts = 0;

    (function tryInit() {
      var ready = init();
      if (!ready && attempts < INIT_ATTEMPTS) {
        attempts += 1;
        setTimeout(tryInit, INIT_DELAY_MS);
      }
    })();
  });
})(jQuery, window.Craft, window.Garnish);
