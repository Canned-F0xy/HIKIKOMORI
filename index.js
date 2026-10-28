(() => {
  const { metro, patcher } = vendetta;

  const EXACT_LABELS = [
    "초대", "초대하기", "멤버 초대", "친구 초대", "멤버 초대하기", "친구 초대하기",
    "서버에 초대하기", "서버로 초대하기", "초대 링크 만들기",
    "invite", "invite members", "invite friends", "invite to server", "create invite",
  ].map((k) => k.toLowerCase());

  const A11Y_SUFFIXES = ["초대", "초대하기"];
  const A11Y_PREFIXES = ["invite "];
  const CHANNEL_WORDS = ["채널", "channel", "스레드", "thread", "포럼", "forum"];

  const ICON_ASSET_NAMES = [
    "UserPlusIcon", "GroupPlusIcon", "ic_invite_24px",
    "ic_add_friend", "ic_person_add", "ic_group_add",
  ];

  const ICON_COMPONENT_RE = /^(UserPlus|GroupPlus|UsersPlus|Invite)Icon/;

  const DEBUG = true;

  let inviteAssetIds = new Set();

  function loadAssetIds() {
    const getId = vendetta.ui?.assets?.getAssetIDByName;
    if (!getId) return;
    for (const name of ICON_ASSET_NAMES) {
      try {
        const id = getId(name);
        if (id != null) inviteAssetIds.add(id);
      } catch {}
    }
  }

  function isInviteAsset(value) {
    if (value == null) return false;
    if (typeof value === "number") return inviteAssetIds.has(value);
    if (typeof value === "object" && typeof value.uri !== "string") {
      return inviteAssetIds.has(value);
    }
    return false;
  }

  function typeName(type) {
    if (!type || (typeof type !== "function" && typeof type !== "object")) return "";
    return type.displayName || type.name || type.type?.displayName || type.type?.name || "";
  }

  function isChannelElement(props) {
    return props.channel != null || props.channelId != null || props.thread != null;
  }

  function isInviteA11y(label) {
    const n = label.trim().toLowerCase();
    if (CHANNEL_WORDS.some((w) => n.includes(w))) return false;
    if (EXACT_LABELS.includes(n)) return true;
    if (A11Y_SUFFIXES.some((s) => n.endsWith(s))) return true;
    if (A11Y_PREFIXES.some((p) => n.startsWith(p))) return true;
    return false;
  }

  function shouldHide(type, props) {
    const name = typeName(type);
    if (name && ICON_COMPONENT_RE.test(name)) {
      if (DEBUG) console.log(`[HideInvite] component: ${name}`);
      return true;
    }

    if (!props || typeof props !== "object") return false;
    if (isChannelElement(props)) return false;

    for (const key of ["label", "text", "title"]) {
      const v = props[key];
      if (typeof v !== "string") continue;
      const n = v.trim().toLowerCase();
      if (DEBUG && /초대|invite/.test(n)) console.log(`[HideInvite] ${key}: "${v}"`);
      if (EXACT_LABELS.includes(n)) return true;
    }

    const a11y = props.accessibilityLabel ?? props["aria-label"];
    if (typeof a11y === "string") {
      if (DEBUG && /초대|invite/i.test(a11y)) console.log(`[HideInvite] a11y: "${a11y}"`);
      if (isInviteA11y(a11y)) return true;
    }

    for (const key of ["icon", "source", "iconSource"]) {
      if (isInviteAsset(props[key])) {
        if (DEBUG) console.log(`[HideInvite] asset via ${key}`);
        return true;
      }
    }

    return false;
  }

  const unpatches = [];

  return {
    onLoad() {
      loadAssetIds();

      const runtime = metro.findByProps("jsx", "jsxs");
      if (runtime) {
        for (const fn of ["jsx", "jsxs"]) {
          unpatches.push(
            patcher.instead(fn, runtime, (args, orig) =>
              shouldHide(args[0], args[1]) ? orig(runtime.Fragment, {}) : orig(...args)
            )
          );
        }
      }

      const React = metro.common?.React ?? metro.findByProps("createElement", "useState");
      if (React) {
        unpatches.push(
          patcher.instead("createElement", React, (args, orig) =>
            shouldHide(args[0], args[1]) ? orig(React.Fragment, null) : orig(...args)
          )
        );
      }
    },

    onUnload() {
      for (const unpatch of unpatches) unpatch();
      unpatches.length = 0;
      inviteAssetIds = new Set();
    },
  };
})()
