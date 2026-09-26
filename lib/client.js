window.__ModuleLoader__.load({
	id: "dsh-skills-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		_deepseek_ai_dsh_client_ui_primitives = __toESM(_deepseek_ai_dsh_client_ui_primitives, 1);
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/compat.ts
		function hasMethod(value, method) {
			return typeof value?.[method] === "function";
		}
		/**
		* Read the ≤0.1.4 host-description source off a connection whose current type
		* no longer declares it. Current releases answer the same questions elsewhere.
		* @param connection - the client transport handle.
		* @returns the snapshot source when this release publishes one.
		*/
		function hostDescriptionSourceOf(connection) {
			return connection?.hostDescription;
		}
		function readHostDescription(source) {
			return source !== void 0 && hasMethod(source, "getSnapshot") ? source.getSnapshot?.() : void 0;
		}
		function subscribeHostDescription(source, listener) {
			return source !== void 0 && hasMethod(source, "subscribe") ? source.subscribe?.(listener) : void 0;
		}
		function connectionStateSource(connection) {
			const source = connection?.state;
			return source !== void 0 && hasMethod(source, "getSnapshot") ? source : void 0;
		}
		/** Current transport state, or `undefined` before the first outcome and on releases without the source. */
		function readConnectionState(source) {
			const state = source !== void 0 && hasMethod(source, "getSnapshot") ? source.getSnapshot?.() : void 0;
			return state === "connected" || state === "connecting" || state === "disconnected" ? state : void 0;
		}
		function subscribeConnectionState(source, listener) {
			return source !== void 0 && hasMethod(source, "subscribe") ? source.subscribe?.(listener) : void 0;
		}
		/**
		* Whether a request failed because the transport itself is not usable right
		* now. Only releases that report a state can answer: without the source the
		* caller must treat every failure as a real one, or a broken backend would be
		* reported as an eternal "reconnecting".
		*/
		function transportUnavailable(connection) {
			const source = connectionStateSource(connection);
			return source !== void 0 && readConnectionState(source) !== "connected";
		}
		/**
		* Resolve the chevron-down glyph across DSH releases.
		*
		* 0.1.5 shipped a size-suffixed set (`IconChevronDownOutline14`, 14px filled
		* artwork); 0.1.7 replaced it with a two-weight set drawn on a 16px grid. The
		* kit is imported as a namespace and probed at runtime because a named import
		* of either generation is `undefined` — and a type error — on the other. The
		* seat is decorative: a release that ships none renders without it.
		* @param primitives - the UI primitives module object.
		* @returns the first chevron-down icon this release provides, or `undefined`.
		*/
		function resolveChevronDownIcon(primitives) {
			const kit = primitives;
			for (const name of [
				"IconChevronDownOutlineMedium",
				"IconChevronDownOutlineRegular",
				"IconChevronDownOutline14"
			]) {
				const candidate = kit?.[name];
				if (typeof candidate === "function") return candidate;
			}
		}
		function isClientContextCompatible(ctx) {
			const value = ctx;
			return hasMethod(value?.locale, "register") && hasMethod(value?.locale, "bind") && hasMethod(value?.slots, "inject") && hasMethod(value?.slots, "register") && hasMethod(value, "effect");
		}
		//#endregion
		//#region src/client/api.ts
		/**
		* Typed fetch wrapper over the Skills Manager host API.
		*
		* The Host registers one exact Fetch route on DSH's shared `/api` channel; the
		* method selector travels in the JSON body so the transport stays a single
		* fenced, authenticated route instead of a plugin-owned URL space.
		*/
		/** Absolute path of the Host route, mirrored from `src/routes.ts`. */
		const API_PATH = "/api/skills-manager";
		var SkillsApiError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.code = code;
			}
		};
		async function call(method, payload, signal) {
			let response;
			try {
				response = await fetch(API_PATH, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						method,
						...payload
					}),
					signal
				});
			} catch (error) {
				throw new SkillsApiError("network", error instanceof Error ? error.message : String(error));
			}
			let body;
			try {
				body = await response.json();
			} catch {
				throw new SkillsApiError("bad-response", `server returned non-JSON (${response.status})`);
			}
			if (!response.ok || !isOk(body)) {
				const message = isError(body) ? body.error.message : `HTTP ${response.status}`;
				throw new SkillsApiError(isError(body) ? body.error.code : "http", message);
			}
			return body.value;
		}
		function isOk(value) {
			return typeof value === "object" && value !== null && value.ok === true;
		}
		function isError(value) {
			return typeof value === "object" && value !== null && value.ok === false;
		}
		const skillsManagerApi = {
			skillsDirectory() {
				return call("skills.directory", {});
			},
			listSkills(cwd) {
				return call("skills.list", cwd === void 0 ? {} : { cwd });
			},
			getSkill(name, cwd) {
				return call("skills.get", {
					name,
					...cwd === void 0 ? {} : { cwd }
				});
			},
			createSkill(input) {
				return call("skills.create", input);
			},
			updateSkill(input) {
				return call("skills.update", input);
			},
			deleteSkill(name, cwd) {
				return call("skills.delete", {
					name,
					...cwd === void 0 ? {} : { cwd }
				});
			},
			scanExternal(cwd) {
				return call("import.scan", cwd === void 0 ? {} : { cwd });
			},
			importMeta() {
				return call("import.meta", {});
			},
			listConflicts(cwd) {
				return call("import.conflicts", cwd === void 0 ? {} : { cwd });
			},
			resolveConflict(name, source, cwd) {
				return call("import.resolve", {
					name,
					source,
					...cwd === void 0 ? {} : { cwd }
				});
			},
			auditDuplicates(cwd) {
				return call("import.audit", cwd === void 0 ? {} : { cwd });
			}
		};
		//#endregion
		//#region src/client/overflow.ts
		/** Return true when content exceeds the measured collapsed box. */
		function hasCollapsedOverflow(scrollHeight, clientHeight) {
			return scrollHeight > clientHeight + 1;
		}
		//#endregion
		//#region \0dsh-css:D:\code\ai\dsh-skills-manager\src\client\ExpandableText.module.css.mjs
		const css$4 = ".Lfdt4W_clamped{overflow-wrap:anywhere}.Lfdt4W_toggle{color:var(--dsw-alias-brand-primary);cursor:pointer;font:inherit;background:0 0;border:0;margin-top:4px;padding:0;font-size:12px;line-height:18px}.Lfdt4W_toggle:hover{color:var(--dsw-alias-brand-primary)}";
		const tagId$4 = "dsh-skills-manager/ExpandableText.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-skills-manager";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var ExpandableText_module_css_default = {
			"clamped": "Lfdt4W_clamped",
			"toggle": "Lfdt4W_toggle"
		};
		//#endregion
		//#region src/client/ExpandableText.tsx
		/** Text that clamps to two lines and expands only when it really overflows. */
		function ExpandableText({ children, t, collapsedLines = 2, className, style }) {
			const textRef = (0, react.useRef)(null);
			const [expanded, setExpanded] = (0, react.useState)(false);
			const [overflow, setOverflow] = (0, react.useState)(false);
			const measureOverflow = (0, react.useCallback)(() => {
				const node = textRef.current;
				if (node === null || expanded) return;
				setOverflow(hasCollapsedOverflow(node.scrollHeight, node.clientHeight));
			}, [expanded]);
			(0, react.useLayoutEffect)(() => {
				measureOverflow();
				const node = textRef.current;
				if (node === null) return;
				const resizeObserver = typeof ResizeObserver === "undefined" ? void 0 : new ResizeObserver(measureOverflow);
				resizeObserver?.observe(node);
				window.addEventListener("resize", measureOverflow);
				return () => {
					resizeObserver?.disconnect();
					window.removeEventListener("resize", measureOverflow);
				};
			}, [
				children,
				collapsedLines,
				measureOverflow
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className,
				style,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					ref: textRef,
					style: expanded ? { overflowWrap: "anywhere" } : {
						display: "-webkit-box",
						WebkitBoxOrient: "vertical",
						WebkitLineClamp: collapsedLines,
						overflow: "hidden",
						overflowWrap: "anywhere"
					},
					children
				}), overflow ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: ExpandableText_module_css_default.toggle,
					"aria-expanded": expanded,
					onClick: () => setExpanded((value) => !value),
					children: expanded ? t("text.collapse") : t("text.expand")
				}) : null]
			});
		}
		//#endregion
		//#region \0dsh-css:D:\code\ai\dsh-skills-manager\src\client\SkillsSection.module.css.mjs
		const css$3 = ".iH3hCa_page{width:100%;min-width:0;max-width:720px;color:var(--dsw-alias-label-primary)}.iH3hCa_listPage{flex-direction:column;height:100%;min-height:0;display:flex}.iH3hCa_titleRow{flex:none;justify-content:space-between;align-items:flex-start;gap:12px;min-width:0;margin-bottom:16px;display:flex}.iH3hCa_pageTitle{min-width:0;color:var(--dsw-alias-label-primary);text-overflow:ellipsis;margin:0;font-size:16px;font-weight:500;line-height:24px;overflow:hidden}.iH3hCa_titleActions{flex-wrap:wrap;flex:none;justify-content:flex-end;align-items:center;gap:6px;display:flex}.iH3hCa_toolbar{flex-wrap:wrap;flex:none;align-items:center;gap:8px;min-width:0;margin-bottom:16px;display:flex}.iH3hCa_search{flex:220px;min-width:180px}.iH3hCa_inputField{box-sizing:border-box;width:100%;display:flex}.iH3hCa_textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;min-width:0;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;font-size:14px;line-height:22px}.iH3hCa_textarea:focus{border-color:var(--dsw-alias-brand-primary);outline:none}.iH3hCa_textarea:disabled{cursor:not-allowed;opacity:.4}.iH3hCa_textarea{resize:vertical;min-height:96px;padding:8px}.iH3hCa_codeTextarea{min-height:280px;font-family:var(--ds-font-family-code,ui-monospace, SFMono-Regular, Consolas, monospace);white-space:pre-wrap}.iH3hCa_editorForm{gap:16px;display:grid}.iH3hCa_field{gap:6px;min-width:0;display:grid}.iH3hCa_fieldLabel{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}.iH3hCa_error,.iH3hCa_info{border:1px solid var(--dsw-alias-border-l2);overflow-wrap:anywhere;border-radius:8px;flex:none;margin-bottom:12px;padding:9px 12px;font-size:14px;line-height:22px}.iH3hCa_error{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, var(--dsw-alias-bg-layer-1))}.iH3hCa_info{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1)}.iH3hCa_skillName,.iH3hCa_location{text-overflow:ellipsis;white-space:nowrap;min-width:0;display:block;overflow:hidden}.iH3hCa_location{color:var(--dsw-alias-label-secondary);cursor:help}.iH3hCa_location code,.iH3hCa_skillName code,.iH3hCa_recordSkill,.iH3hCa_groupName{font-family:var(--ds-font-family-code,ui-monospace, SFMono-Regular, Consolas, monospace)}.iH3hCa_location code{font-size:12px}.iH3hCa_empty{color:var(--dsw-alias-label-secondary);margin:16px 0 0}.iH3hCa_codeBlock{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-markdown-code-block);max-height:400px;color:var(--dsw-alias-label-secondary);font:var(--ds-font-markdown-code-block-small);white-space:pre-wrap;overflow-wrap:anywhere;border-radius:8px;margin:16px 0 0;padding:12px;overflow:auto}.iH3hCa_importSection{border-top:1px solid var(--dsw-alias-border-l1);min-width:0;padding:16px 0}.iH3hCa_importSection:first-of-type{border-top:0;padding-top:0}.iH3hCa_sectionTitle{color:var(--dsw-alias-label-primary);margin:0 0 12px;font-size:14px;font-weight:500;line-height:22px}.iH3hCa_summaryGrid{grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;display:grid}.iH3hCa_summaryItem{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:12px;gap:2px;min-width:0;padding:10px 12px;display:grid}.iH3hCa_summaryNumber{font-variant-numeric:tabular-nums;font-size:16px;font-weight:500;line-height:24px}.iH3hCa_summaryLabel,.iH3hCa_caption,.iH3hCa_note,.iH3hCa_groupMeta,.iH3hCa_recordSource{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.iH3hCa_summaryLabel{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.iH3hCa_caption{color:var(--dsw-alias-label-caption);margin:8px 0 0}.iH3hCa_metricList{gap:2px;max-width:520px;display:grid}.iH3hCa_metricRow{min-width:0;color:var(--dsw-alias-label-secondary);justify-content:space-between;gap:16px;padding:5px 0;font-size:14px;line-height:22px;display:flex}.iH3hCa_metricRow strong{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;flex:none}.iH3hCa_metricRowStrong{border-top:1px solid var(--dsw-alias-border-l2);margin-top:2px;padding-top:7px}.iH3hCa_note{overflow-wrap:anywhere;max-width:640px;margin:8px 0 0}.iH3hCa_groupList{gap:8px;display:grid}.iH3hCa_groupRow{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;gap:3px;min-width:0;padding:9px 12px;display:grid}.iH3hCa_groupName{color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}.iH3hCa_filterRow{flex-wrap:wrap;gap:6px;margin-bottom:12px;display:flex}.iH3hCa_recordList{border-top:1px solid var(--dsw-alias-border-l1);max-height:min(560px,60vh);display:grid;overflow-y:auto}.iH3hCa_recordRow{border-bottom:1px solid var(--dsw-alias-border-l1);gap:4px;min-width:0;padding:10px 0;display:grid}.iH3hCa_recordHeader{flex-wrap:wrap;align-items:center;gap:8px;min-width:0;display:flex}.iH3hCa_recordSkill{text-overflow:ellipsis;white-space:nowrap;max-width:45%;overflow:hidden}.iH3hCa_recordReason{min-width:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}.iH3hCa_modal{width:min(520px,100vw - 48px)}.iH3hCa_modalActions{flex-wrap:wrap;justify-content:flex-end;gap:8px;display:flex}.iH3hCa_dangerButton{color:var(--dsw-alias-state-error-primary)}@media (width<=640px){.iH3hCa_titleRow{flex-direction:column;align-items:stretch}.iH3hCa_titleActions{justify-content:flex-start}.iH3hCa_summaryGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (width<=520px){.iH3hCa_summaryGrid{grid-template-columns:1fr}.iH3hCa_recordSkill{max-width:100%}}";
		const tagId$3 = "dsh-skills-manager/SkillsSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-skills-manager";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var SkillsSection_module_css_default = {
			"caption": "iH3hCa_caption",
			"codeBlock": "iH3hCa_codeBlock",
			"codeTextarea": "iH3hCa_codeTextarea",
			"dangerButton": "iH3hCa_dangerButton",
			"editorForm": "iH3hCa_editorForm",
			"empty": "iH3hCa_empty",
			"error": "iH3hCa_error",
			"field": "iH3hCa_field",
			"fieldLabel": "iH3hCa_fieldLabel",
			"filterRow": "iH3hCa_filterRow",
			"groupList": "iH3hCa_groupList",
			"groupMeta": "iH3hCa_groupMeta",
			"groupName": "iH3hCa_groupName",
			"groupRow": "iH3hCa_groupRow",
			"importSection": "iH3hCa_importSection",
			"info": "iH3hCa_info",
			"inputField": "iH3hCa_inputField",
			"listPage": "iH3hCa_listPage",
			"location": "iH3hCa_location",
			"metricList": "iH3hCa_metricList",
			"metricRow": "iH3hCa_metricRow",
			"metricRowStrong": "iH3hCa_metricRowStrong",
			"modal": "iH3hCa_modal",
			"modalActions": "iH3hCa_modalActions",
			"note": "iH3hCa_note",
			"page": "iH3hCa_page",
			"pageTitle": "iH3hCa_pageTitle",
			"recordHeader": "iH3hCa_recordHeader",
			"recordList": "iH3hCa_recordList",
			"recordReason": "iH3hCa_recordReason",
			"recordRow": "iH3hCa_recordRow",
			"recordSkill": "iH3hCa_recordSkill",
			"recordSource": "iH3hCa_recordSource",
			"search": "iH3hCa_search",
			"sectionTitle": "iH3hCa_sectionTitle",
			"skillName": "iH3hCa_skillName",
			"summaryGrid": "iH3hCa_summaryGrid",
			"summaryItem": "iH3hCa_summaryItem",
			"summaryLabel": "iH3hCa_summaryLabel",
			"summaryNumber": "iH3hCa_summaryNumber",
			"textarea": "iH3hCa_textarea",
			"titleActions": "iH3hCa_titleActions",
			"titleRow": "iH3hCa_titleRow",
			"toolbar": "iH3hCa_toolbar"
		};
		//#endregion
		//#region src/client/ExternalImportView.tsx
		function ExternalImportView({ report, busy, onBack, onScanAgain, t }) {
			const [filter, setFilter] = (0, react.useState)("all");
			const items = (0, react.useMemo)(() => report.items.filter((item) => filter === "all" || item.result === filter), [filter, report.items]);
			const groups = report.duplicateGroups.filter((group) => group.candidateCount > 1).sort((a, b) => b.candidateCount - a.candidateCount);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SkillsSection_module_css_default.page,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillsSection_module_css_default.titleRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: SkillsSection_module_css_default.pageTitle,
							children: t("import.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SkillsSection_module_css_default.titleActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								onClick: onBack,
								children: t("import.back")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								size: "sm",
								disabled: busy,
								onClick: onScanAgain,
								children: t("import.scanAgain")
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: SkillsSection_module_css_default.importSection,
						"aria-labelledby": "skills-import-overview",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								id: "skills-import-overview",
								className: SkillsSection_module_css_default.sectionTitle,
								children: t("import.overview.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SkillsSection_module_css_default.summaryGrid,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SummaryItem, {
										label: t("import.summary.scanned"),
										value: report.scannedCandidates
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SummaryItem, {
										label: t("import.summary.inDsh"),
										value: report.inDsh
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SummaryItem, {
										label: t("import.summary.deduplicated"),
										value: report.duplicateCopies
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SummaryItem, {
										label: t("import.summary.conflicts"),
										value: report.conflicts
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SummaryItem, {
										label: t("import.summary.invalid"),
										value: report.invalid
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: SkillsSection_module_css_default.caption,
								children: t("import.lastScan", { time: formatTimestamp(report.finishedAt) })
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: SkillsSection_module_css_default.importSection,
						"aria-labelledby": "skills-import-details",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								id: "skills-import-details",
								className: SkillsSection_module_css_default.sectionTitle,
								children: t("import.details.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SkillsSection_module_css_default.metricList,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
										label: t("import.details.scanned"),
										value: report.scannedCandidates
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
										label: t("import.details.uniqueValid"),
										value: report.uniqueValidSkills
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
										label: t("import.details.inDsh"),
										value: report.inDsh
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
										label: t("import.details.importedThisScan"),
										value: report.importedThisScan
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
										label: t("import.details.deduplicated"),
										value: report.duplicateCopies
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
										label: t("import.details.conflicts"),
										value: report.conflicts
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
										label: t("import.details.invalid"),
										value: report.invalid
									}),
									report.failed > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
										label: t("import.details.failed"),
										value: report.failed
									}) : null
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: SkillsSection_module_css_default.note,
								children: t("import.unitNote")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: SkillsSection_module_css_default.importSection,
						"aria-labelledby": "skills-import-breakdown",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							id: "skills-import-breakdown",
							className: SkillsSection_module_css_default.sectionTitle,
							children: t("import.breakdown.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SkillsSection_module_css_default.metricList,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
									label: t("import.breakdown.samePath"),
									value: report.duplicateBreakdown.samePath
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
									label: t("import.breakdown.sameContent"),
									value: report.duplicateBreakdown.sameContent
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
									label: t("import.breakdown.alreadyInDsh"),
									value: report.duplicateBreakdown.alreadyInDsh
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MetricRow, {
									label: t("import.breakdown.total"),
									value: report.duplicateCopies,
									strong: true
								})
							]
						})]
					}),
					groups.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: SkillsSection_module_css_default.importSection,
						"aria-labelledby": "skills-import-groups",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							id: "skills-import-groups",
							className: SkillsSection_module_css_default.sectionTitle,
							children: t("import.groups.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: SkillsSection_module_css_default.groupList,
							children: groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SkillsSection_module_css_default.groupRow,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
										className: SkillsSection_module_css_default.groupName,
										children: group.name
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: SkillsSection_module_css_default.groupMeta,
										children: [
											t("import.groups.status"),
											": ",
											group.inDsh ? t("import.groups.statusInDsh") : t("import.groups.statusNotInDsh")
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: SkillsSection_module_css_default.groupMeta,
										children: [
											t("import.groups.sources"),
											": ",
											[...new Set(group.sources.map((source) => source.source))].join(", ")
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: SkillsSection_module_css_default.groupMeta,
										children: [
											t("import.groups.candidates"),
											": ",
											group.candidateCount,
											" · ",
											t("import.groups.uniqueSkill"),
											": 1"
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: SkillsSection_module_css_default.groupMeta,
										children: [
											t("import.groups.result"),
											": ",
											group.importedThisScan ? t("import.groups.resultImported") : t("import.groups.resultMerged")
										]
									})
								]
							}, group.key))
						})]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: SkillsSection_module_css_default.importSection,
						"aria-labelledby": "skills-import-records",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								id: "skills-import-records",
								className: SkillsSection_module_css_default.sectionTitle,
								children: t("import.records.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: SkillsSection_module_css_default.filterRow,
								role: "group",
								"aria-label": t("import.records.title"),
								children: [
									"all",
									"new",
									"duplicate",
									"conflict",
									"invalid",
									"skipped"
								].map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
									active: filter === name,
									onClick: () => setFilter(name === "all" ? "all" : name),
									children: name === "all" ? t("import.filter.all") : t(`import.filter.${name}`)
								}, name))
							}),
							items.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: SkillsSection_module_css_default.empty,
								children: t("import.noItems")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: SkillsSection_module_css_default.recordList,
								children: items.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
									className: SkillsSection_module_css_default.recordRow,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: SkillsSection_module_css_default.recordHeader,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
												className: SkillsSection_module_css_default.recordSkill,
												children: item.skill
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: SkillsSection_module_css_default.recordSource,
												children: item.source
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, { children: t(`import.result.${item.result}`) })
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ExpandableText, {
										t,
										className: SkillsSection_module_css_default.recordReason,
										children: item.reason
									})]
								}, `${item.source}-${item.skill}-${index}`))
							})
						]
					})
				]
			});
		}
		function SummaryItem({ label, value }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SkillsSection_module_css_default.summaryItem,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
					className: SkillsSection_module_css_default.summaryNumber,
					children: value
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: SkillsSection_module_css_default.summaryLabel,
					children: label
				})]
			});
		}
		function MetricRow({ label, value, strong = false }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `${SkillsSection_module_css_default.metricRow} ${strong ? SkillsSection_module_css_default.metricRowStrong : ""}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: value })]
			});
		}
		function formatTimestamp(value) {
			const date = new Date(value);
			return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
		}
		//#endregion
		//#region \0dsh-css:D:\code\ai\dsh-skills-manager\src\client\ScopeSelect.module.css.mjs
		const css$2 = ".DA9hCW_root{width:100%;min-width:0;display:flex}.DA9hCW_trigger{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;min-width:0;height:32px;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;text-align:left;border-radius:8px;outline:none;justify-content:space-between;align-items:center;gap:8px;padding:0 8px;font-size:14px;line-height:22px;display:inline-flex}.DA9hCW_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.DA9hCW_trigger:focus-visible,.DA9hCW_trigger[aria-expanded=true]{border-color:var(--dsw-alias-brand-primary)}.DA9hCW_trigger:disabled{cursor:not-allowed;opacity:.4}.DA9hCW_triggerLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.DA9hCW_chevron{color:var(--dsw-alias-label-caption);flex:none}";
		const tagId$2 = "dsh-skills-manager/ScopeSelect.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-skills-manager";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var ScopeSelect_module_css_default = {
			"chevron": "DA9hCW_chevron",
			"root": "DA9hCW_root",
			"trigger": "DA9hCW_trigger",
			"triggerLabel": "DA9hCW_triggerLabel"
		};
		//#endregion
		//#region src/client/ScopeSelect.tsx
		/**
		* Scope picker for the skill editor: `global` or `project`.
		*
		* Composition follows DSH's own settings-side permission selector
		* (ui-permission-presets PermissionRow): a plain button trigger carrying
		* `aria-haspopup`/`aria-expanded` plus the shared chevron glyph, anchoring a
		* `Menu` whose `selectedId` draws the native check mark. Keyboard, Escape and
		* outside-click dismissal all belong to the primitive.
		*/
		/** Resolved once: the primitives kit is one module for the whole page, not a per-render value. */
		const ChevronDown = resolveChevronDownIcon(_deepseek_ai_dsh_client_ui_primitives);
		function ScopeSelect({ value, onChange, disabled = false, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open,
				onClose: () => {
					setOpen(false);
				},
				items: [{
					id: "global",
					label: t("editor.global")
				}, {
					id: "project",
					label: t("editor.project")
				}],
				selectedId: value,
				onSelect: (id) => {
					setOpen(false);
					onChange(id);
				},
				portal: true,
				className: ScopeSelect_module_css_default.root,
				anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: ScopeSelect_module_css_default.trigger,
					"aria-haspopup": "menu",
					"aria-expanded": open,
					"aria-label": t("editor.scope"),
					disabled,
					onClick: () => {
						setOpen((current) => !current);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ScopeSelect_module_css_default.triggerLabel,
						children: value === "project" ? t("editor.project") : t("editor.global")
					}), ChevronDown === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChevronDown, { className: ScopeSelect_module_css_default.chevron })]
				})
			});
		}
		//#endregion
		//#region src/client/SkillEditor.tsx
		const EMPTY_DRAFT = {
			name: "",
			description: "",
			whenToUse: "",
			body: "",
			scope: "global"
		};
		function SkillEditor({ mode, draft, setDraft, selectedName, busy, error, onCancel, onSave, t }) {
			const editing = mode === "edit";
			const title = editing ? t("editor.editTitle", { name: selectedName ?? draft.name }) : t("editor.newTitle");
			const update = (patch) => setDraft((current) => ({
				...current,
				...patch
			}));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SkillsSection_module_css_default.page,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillsSection_module_css_default.titleRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: SkillsSection_module_css_default.pageTitle,
							children: title
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SkillsSection_module_css_default.titleActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								disabled: busy,
								onClick: onCancel,
								children: t("editor.cancel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								size: "sm",
								disabled: busy,
								onClick: onSave,
								children: t("editor.save")
							})]
						})]
					}),
					error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SkillsSection_module_css_default.error,
						role: "alert",
						children: error
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillsSection_module_css_default.editorForm,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: SkillsSection_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SkillsSection_module_css_default.fieldLabel,
									children: t("editor.name")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
									className: SkillsSection_module_css_default.inputField,
									value: draft.name,
									disabled: editing,
									onChange: (event) => update({ name: event.target.value }),
									placeholder: t("editor.namePlaceholder"),
									"aria-label": t("editor.name")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SkillsSection_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SkillsSection_module_css_default.fieldLabel,
									children: t("editor.scope")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ScopeSelect, {
									value: draft.scope,
									onChange: (scope) => update({ scope }),
									disabled: editing,
									t
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: SkillsSection_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SkillsSection_module_css_default.fieldLabel,
									children: t("editor.description")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									className: SkillsSection_module_css_default.textarea,
									value: draft.description,
									onChange: (event) => update({ description: event.target.value }),
									rows: 4
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: SkillsSection_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SkillsSection_module_css_default.fieldLabel,
									children: t("editor.whenToUse")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
									className: SkillsSection_module_css_default.inputField,
									value: draft.whenToUse,
									onChange: (event) => update({ whenToUse: event.target.value }),
									"aria-label": t("editor.whenToUse")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: SkillsSection_module_css_default.field,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SkillsSection_module_css_default.fieldLabel,
									children: t("editor.body")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									className: `${SkillsSection_module_css_default.textarea} ${SkillsSection_module_css_default.codeTextarea}`,
									value: draft.body,
									onChange: (event) => update({ body: event.target.value }),
									rows: 14,
									spellCheck: false
								})]
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:D:\code\ai\dsh-skills-manager\src\client\SkillActions.module.css.mjs
		const css$1 = ".uXRGlq_trigger{min-width:28px;padding-inline:6px;font-size:18px;line-height:1}";
		const tagId$1 = "dsh-skills-manager/SkillActions.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-skills-manager";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var SkillActions_module_css_default = { "trigger": "uXRGlq_trigger" };
		//#endregion
		//#region src/client/SkillActions.tsx
		/** Compact row actions: one stable-width trigger and a DSH-native menu. */
		function SkillActions({ t, onView, onEdit, onDelete, disabled = false }) {
			const [open, setOpen] = (0, react.useState)(false);
			const close = () => setOpen(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open,
				onClose: close,
				onSelect: (id) => {
					close();
					if (id === "view") onView();
					if (id === "edit") onEdit();
					if (id === "delete") onDelete();
				},
				items: [
					{
						id: "view",
						label: t("table.view"),
						disabled
					},
					{
						id: "edit",
						label: t("table.edit"),
						disabled
					},
					{
						id: "delete",
						label: t("table.delete"),
						danger: true,
						disabled
					}
				],
				align: "end",
				portal: true,
				compact: true,
				anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "toolbar",
					size: "sm",
					"aria-label": t("actions.label"),
					"aria-haspopup": "menu",
					"aria-expanded": open,
					disabled,
					onClick: () => setOpen((value) => !value),
					className: SkillActions_module_css_default.trigger,
					children: "⋯"
				})
			});
		}
		//#endregion
		//#region src/client/open-skills-folder.ts
		/** The ≤0.1.4 connection facade, reached structurally because no current release declares it. */
		function legacyHost(connection) {
			return connection?.api?.host;
		}
		/**
		* Whether this deployment can open the skills directory in the OS file manager.
		*
		* The remote carrier answers only the Host desktop can give; the legacy carrier
		* answers synchronously from a snapshot the shell already publishes. A loopback
		* transport is required either way: a remote browser has no Host filesystem to
		* show.
		* @param connection - the client transport handle.
		* @param description - legacy host facts, when this release publishes them.
		* @param session - the ≥0.1.7 session Remote namespace, when this release mounts it.
		* @returns whether to offer the control; failures read as "no".
		*/
		async function canOpenSkillsDirectory(connection, description, session) {
			if (connection?.isLoopback !== true) return false;
			if (typeof session?.canOpenWorkspacePath === "function") try {
				const reply = await session.canOpenWorkspacePath();
				return reply?.ok === true && reply.value === true;
			} catch {
				return false;
			}
			return description?.canOpenPath === true;
		}
		/**
		* Resolve the fixed directory through the Host API, then hand it to whichever
		* opener this release carries.
		* @param api - the plugin Host API; its directory call takes no path input.
		* @param connection - the client transport handle (legacy carrier).
		* @param session - the ≥0.1.7 session Remote namespace.
		* @returns the directory that was opened.
		* @throws when this release carries no opener, or the Host refuses the gesture.
		*/
		async function openSkillsDirectory(api, connection, session) {
			const { directory } = await api.skillsDirectory();
			if (typeof session?.openWorkspacePath === "function") {
				if ((await session.openWorkspacePath({ path: directory }))?.ok !== true) throw new Error("the Host refused to open the skills directory");
				return directory;
			}
			const host = legacyHost(connection);
			if (host?.openPath === void 0) throw new Error("this DSH release has no way to open a Host path");
			const result = await host.openPath({ path: directory });
			if (result?.result?.ok !== true) throw new Error(result?.result?.error?.message ?? "the Host refused to open the skills directory");
			return directory;
		}
		//#endregion
		//#region \0dsh-css:D:\code\ai\dsh-skills-manager\src\client\SkillsTable.module.css.mjs
		const css = ".MZZmha_viewport{scrollbar-gutter:stable;-webkit-overflow-scrolling:touch;flex:auto;width:100%;min-width:0;min-height:0;overflow:auto}.MZZmha_table{table-layout:fixed;border-collapse:separate;border-spacing:0;width:100%;min-width:700px;font-size:14px;line-height:22px}.MZZmha_headerCell,.MZZmha_cell{box-sizing:border-box;text-align:left;vertical-align:top;min-width:0;padding:9px 8px;overflow:hidden}.MZZmha_headerCell{z-index:2;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px;position:sticky;top:0}.MZZmha_cell{border-bottom:1px solid var(--dsw-alias-border-l1)}.MZZmha_actionsHeader,.MZZmha_actionsCell{background:var(--dsw-alias-bg-layer-2);border-left:1px solid var(--dsw-alias-border-l2);text-align:right;width:56px;min-width:56px;max-width:56px;padding-right:8px;position:sticky;right:0;overflow:visible}.MZZmha_actionsHeader{z-index:4}.MZZmha_actionsCell{z-index:3}.MZZmha_nameColumn{width:20%}.MZZmha_descriptionColumn{width:auto}.MZZmha_scopeColumn{width:100px}.MZZmha_locationColumn{width:220px}.MZZmha_empty{color:var(--dsw-alias-label-secondary);text-align:left;vertical-align:top;padding:16px 8px}";
		const tagId = "dsh-skills-manager/SkillsTable.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-skills-manager";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SkillsTable_module_css_default = {
			"actionsCell": "MZZmha_actionsCell",
			"actionsHeader": "MZZmha_actionsHeader",
			"cell": "MZZmha_cell",
			"descriptionColumn": "MZZmha_descriptionColumn",
			"empty": "MZZmha_empty",
			"headerCell": "MZZmha_headerCell",
			"locationColumn": "MZZmha_locationColumn",
			"nameColumn": "MZZmha_nameColumn",
			"scopeColumn": "MZZmha_scopeColumn",
			"table": "MZZmha_table",
			"viewport": "MZZmha_viewport"
		};
		//#endregion
		//#region src/client/SkillsSection.tsx
		/** Settings → Skills management surface over DSH's native Skills API. */
		function SkillsSection(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillsErrorBoundary, {
				t: props.t,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillsSectionContent, { ...props })
			});
		}
		function SkillsSectionContent(props) {
			const { api, connection, remote, t } = props;
			const [skills, setSkills] = (0, react.useState)([]);
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)();
			const [search, setSearch] = (0, react.useState)("");
			const [mode, setMode] = (0, react.useState)("list");
			const [selected, setSelected] = (0, react.useState)();
			const [draft, setDraft] = (0, react.useState)(EMPTY_DRAFT);
			const [report, setReport] = (0, react.useState)();
			const [conflicts, setConflicts] = (0, react.useState)([]);
			const [deleteTarget, setDeleteTarget] = (0, react.useState)();
			const [busy, setBusy] = (0, react.useState)(false);
			const hostDescriptionSource = hostDescriptionSourceOf(connection);
			const [hostDescription, setHostDescription] = (0, react.useState)(() => readHostDescription(hostDescriptionSource));
			const [canOpenFolder, setCanOpenFolder] = (0, react.useState)(false);
			const stateSource = connectionStateSource(connection);
			const [connectionState, setConnectionState] = (0, react.useState)(() => readConnectionState(stateSource));
			(0, react.useEffect)(() => {
				setHostDescription(readHostDescription(hostDescriptionSource));
				return subscribeHostDescription(hostDescriptionSource, () => setHostDescription(readHostDescription(hostDescriptionSource)));
			}, [hostDescriptionSource]);
			(0, react.useEffect)(() => {
				let cancelled = false;
				canOpenSkillsDirectory(connection, hostDescription, remote?.session).then((available) => {
					if (!cancelled) setCanOpenFolder(available);
				});
				return () => {
					cancelled = true;
				};
			}, [
				connection,
				hostDescription,
				remote
			]);
			(0, react.useEffect)(() => {
				setConnectionState(readConnectionState(stateSource));
				return subscribeConnectionState(stateSource, () => setConnectionState(readConnectionState(stateSource)));
			}, [stateSource]);
			const loadSkills = (0, react.useCallback)(async () => {
				try {
					setSkills((await api.listSkills()).skills);
				} catch (err) {
					if (transportUnavailable(connection)) return;
					setError(formatError(t, "errors.load", err));
				}
			}, [
				api,
				connection,
				t
			]);
			const loadConflicts = (0, react.useCallback)(async () => {
				try {
					setConflicts((await api.listConflicts()).conflicts);
				} catch {
					setConflicts([]);
				}
			}, [api]);
			const refresh = (0, react.useCallback)(async () => {
				setLoading(true);
				setError(void 0);
				await Promise.all([loadSkills(), loadConflicts()]);
				setLoading(false);
			}, [loadConflicts, loadSkills]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			const previousState = (0, react.useRef)(connectionState);
			(0, react.useEffect)(() => {
				const previous = previousState.current;
				previousState.current = connectionState;
				if (connectionState !== "connected" || previous === "connected") return;
				refresh();
			}, [connectionState, refresh]);
			(0, react.useEffect)(() => {
				if (remote?.$on === void 0) return;
				const dispose = remote.$on("skills/change", () => {
					refresh();
				});
				return () => {
					dispose();
				};
			}, [remote, refresh]);
			const filtered = (0, react.useMemo)(() => {
				const query = search.trim().toLowerCase();
				return query.length === 0 ? skills : skills.filter((skill) => skill.name.toLowerCase().includes(query) || skill.description.toLowerCase().includes(query));
			}, [search, skills]);
			const openDetail = (0, react.useCallback)(async (skill) => {
				try {
					setSelected((await api.getSkill(skill.name)).skill);
					setMode("detail");
				} catch (err) {
					setError(formatError(t, "errors.get", err));
				}
			}, [api, t]);
			const openEdit = (0, react.useCallback)(async (skill) => {
				try {
					const detail = "content" in skill ? skill : (await api.getSkill(skill.name)).skill;
					setSelected(detail);
					setDraft({
						name: detail.name,
						description: detail.description,
						whenToUse: detail.whenToUse ?? "",
						body: detail.content,
						scope: detail.source.includes("project") ? "project" : "global"
					});
					setMode("edit");
				} catch (err) {
					setError(formatError(t, "errors.get", err));
				}
			}, [api, t]);
			const openCreate = (0, react.useCallback)(() => {
				setDraft(EMPTY_DRAFT);
				setSelected(void 0);
				setMode("create");
			}, []);
			const save = (0, react.useCallback)(async () => {
				setBusy(true);
				setError(void 0);
				try {
					if (mode === "create") await api.createSkill({
						name: draft.name,
						description: draft.description,
						whenToUse: draft.whenToUse,
						body: draft.body,
						scope: draft.scope
					});
					else if (mode === "edit" && selected !== void 0) await api.updateSkill({
						name: selected.name,
						description: draft.description,
						whenToUse: draft.whenToUse,
						body: draft.body
					});
					setMode("list");
					await refresh();
				} catch (err) {
					setError(formatError(t, "errors.save", err));
				} finally {
					setBusy(false);
				}
			}, [
				api,
				draft,
				mode,
				refresh,
				selected,
				t
			]);
			const confirmDelete = (0, react.useCallback)(async () => {
				if (deleteTarget === void 0) return;
				setBusy(true);
				setError(void 0);
				try {
					await api.deleteSkill(deleteTarget.name);
					setDeleteTarget(void 0);
					await refresh();
				} catch (err) {
					setError(formatError(t, "errors.delete", err));
				} finally {
					setBusy(false);
				}
			}, [
				api,
				deleteTarget,
				refresh,
				t
			]);
			const scan = (0, react.useCallback)(async () => {
				setBusy(true);
				setError(void 0);
				try {
					setReport((await api.scanExternal()).report);
					setMode("import");
					await refresh();
				} catch (err) {
					setError(formatError(t, "errors.scan", err));
				} finally {
					setBusy(false);
				}
			}, [
				api,
				refresh,
				t
			]);
			const resolve = (0, react.useCallback)(async (conflict, source) => {
				setBusy(true);
				setError(void 0);
				try {
					await api.resolveConflict(conflict.name, source);
					await refresh();
					setMode("conflicts");
				} catch (err) {
					setError(formatError(t, "errors.resolve", err));
				} finally {
					setBusy(false);
				}
			}, [
				api,
				refresh,
				t
			]);
			const openSkillsDirectory$1 = (0, react.useCallback)(async () => {
				if (!canOpenFolder) return;
				setBusy(true);
				setError(void 0);
				try {
					await openSkillsDirectory(api, connection, remote?.session);
				} catch (err) {
					setError(formatError(t, "errors.openSkillsDirectory", err));
				} finally {
					setBusy(false);
				}
			}, [
				api,
				canOpenFolder,
				connection,
				remote,
				t
			]);
			const unavailableLabel = t("toolbar.openSkillsFolderUnavailable");
			if (mode === "detail" && selected !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SkillsSection_module_css_default.page,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(TitleRow, {
						title: selected.name,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							size: "sm",
							onClick: () => setMode("list"),
							children: t("detail.back")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							size: "sm",
							onClick: () => {
								openEdit(selected);
							},
							children: t("detail.edit")
						})]
					}),
					error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SkillsSection_module_css_default.error,
						role: "alert",
						children: error
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: SkillsSection_module_css_default.importSection,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [t("detail.description"), ":"] }),
								" ",
								selected.description
							] }),
							selected.whenToUse !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [t("detail.whenToUse"), ":"] }),
								" ",
								selected.whenToUse
							] }) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [t("detail.source"), ":"] }),
								" ",
								selected.source,
								" · ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [t("detail.provider"), ":"] }),
								" ",
								selected.provider
							] }),
							selected.path !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [t("detail.location"), ":"] }),
								" ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(LocationValue, {
									path: selected.path,
									t
								})
							] }) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [t("detail.modelInvocable"), ":"] }),
								" ",
								selected.modelInvocable ? t("status.yes") : t("status.no"),
								" · ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [t("detail.userInvocable"), ":"] }),
								" ",
								selected.userInvocable ? t("status.yes") : t("status.no")
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
								className: SkillsSection_module_css_default.codeBlock,
								children: selected.content
							})
						]
					})
				]
			});
			if (mode === "create" || mode === "edit") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillEditor, {
				mode,
				draft,
				setDraft,
				selectedName: selected?.name,
				busy,
				error,
				onCancel: () => setMode("list"),
				onSave: () => {
					save();
				},
				t
			});
			if (mode === "import" && report !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ExternalImportView, {
				report,
				busy,
				onBack: () => setMode("list"),
				onScanAgain: () => {
					scan();
				},
				t
			});
			if (mode === "conflicts") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SkillsSection_module_css_default.page,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TitleRow, {
						title: t("import.conflictsTitle"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							size: "sm",
							onClick: () => setMode("list"),
							children: t("import.back")
						})
					}),
					error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SkillsSection_module_css_default.error,
						role: "alert",
						children: error
					}) : null,
					conflicts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SkillsSection_module_css_default.info,
						children: t("import.noPendingConflicts")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SkillsSection_module_css_default.groupList,
						children: conflicts.map((conflict) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SkillsSection_module_css_default.groupRow,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: conflict.name }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SkillsSection_module_css_default.groupMeta,
									children: conflict.reason
								}),
								conflict.existing !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: SkillsSection_module_css_default.groupMeta,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [t("import.dshExisting"), ":"] }),
										" ",
										conflict.existing.path ?? conflict.existing.name
									]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: SkillsSection_module_css_default.titleActions,
									children: conflict.candidates.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										size: "sm",
										disabled: busy,
										onClick: () => {
											resolve(conflict, candidate.source);
										},
										children: t("import.use", { label: candidate.label })
									}, candidate.source))
								})
							]
						}, conflict.name))
					})
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `${SkillsSection_module_css_default.page} ${SkillsSection_module_css_default.listPage}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillsSection_module_css_default.titleRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: SkillsSection_module_css_default.pageTitle,
							children: t("nav.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SkillsSection_module_css_default.titleActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: unavailableLabel,
								side: "top",
								disabled: canOpenFolder,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									disabled: !canOpenFolder || busy,
									onClick: () => {
										openSkillsDirectory$1();
									},
									title: !canOpenFolder ? unavailableLabel : void 0,
									children: t("toolbar.openSkillsFolder")
								}) })
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								size: "sm",
								disabled: busy,
								onClick: openCreate,
								children: t("toolbar.newSkill")
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillsSection_module_css_default.toolbar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
								className: SkillsSection_module_css_default.search,
								value: search,
								onChange: (event) => setSearch(event.target.value),
								placeholder: t("toolbar.searchPlaceholder"),
								"aria-label": t("toolbar.searchPlaceholder")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								size: "sm",
								disabled: busy,
								onClick: () => setMode("conflicts"),
								children: [
									t("toolbar.conflicts"),
									" (",
									conflicts.length,
									")"
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								size: "sm",
								disabled: busy,
								onClick: () => {
									scan();
								},
								children: t("toolbar.scanExternal")
							})
						]
					}),
					error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SkillsSection_module_css_default.error,
						role: "alert",
						children: error
					}) : null,
					loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SkillsSection_module_css_default.info,
						children: t("status.loading")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: SkillsTable_module_css_default.viewport,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
							className: SkillsTable_module_css_default.table,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									className: `${SkillsTable_module_css_default.headerCell} ${SkillsTable_module_css_default.nameColumn}`,
									children: t("table.name")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									className: `${SkillsTable_module_css_default.headerCell} ${SkillsTable_module_css_default.descriptionColumn}`,
									children: t("table.description")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									className: `${SkillsTable_module_css_default.headerCell} ${SkillsTable_module_css_default.scopeColumn}`,
									children: t("table.scope")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									className: `${SkillsTable_module_css_default.headerCell} ${SkillsTable_module_css_default.locationColumn}`,
									children: t("table.location")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									className: `${SkillsTable_module_css_default.headerCell} ${SkillsTable_module_css_default.actionsHeader}`,
									children: t("table.actions")
								})
							] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tbody", { children: [filtered.map((skill) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									className: SkillsTable_module_css_default.cell,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SkillsSection_module_css_default.skillName,
										title: skill.name,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: skill.name })
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									className: SkillsTable_module_css_default.cell,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ExpandableText, {
										t,
										children: skill.description
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									className: SkillsTable_module_css_default.cell,
									children: skill.source
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									className: SkillsTable_module_css_default.cell,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LocationValue, {
										path: skill.path,
										t
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									className: `${SkillsTable_module_css_default.cell} ${SkillsTable_module_css_default.actionsCell}`,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkillActions, {
										t,
										disabled: busy,
										onView: () => {
											openDetail(skill);
										},
										onEdit: () => {
											openEdit(skill);
										},
										onDelete: () => setDeleteTarget(skill)
									})
								})
							] }, skill.name)), filtered.length === 0 && !loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
								colSpan: 5,
								className: SkillsTable_module_css_default.empty,
								children: t("table.empty")
							}) }) : null] })]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: deleteTarget !== void 0,
						onClose: () => {
							if (!busy) setDeleteTarget(void 0);
						},
						title: deleteTarget === void 0 ? t("delete.title", { name: "" }) : t("delete.title", { name: deleteTarget.name }),
						closeLabel: t("dialog.close"),
						description: t("delete.warning"),
						className: SkillsSection_module_css_default.modal,
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SkillsSection_module_css_default.modalActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								disabled: busy,
								onClick: () => setDeleteTarget(void 0),
								children: t("delete.cancel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								size: "sm",
								className: SkillsSection_module_css_default.dangerButton,
								disabled: busy,
								onClick: () => {
									confirmDelete();
								},
								children: t("delete.confirm")
							})]
						}),
						children: error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: SkillsSection_module_css_default.error,
							role: "alert",
							children: error
						}) : null
					})
				]
			});
		}
		function TitleRow({ title, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SkillsSection_module_css_default.titleRow,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
					className: SkillsSection_module_css_default.pageTitle,
					children: title
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: SkillsSection_module_css_default.titleActions,
					children
				})]
			});
		}
		function LocationValue({ path, t }) {
			if (path === void 0 || path.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("table.locationUnavailable") });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: path,
				side: "top",
				maxWidth: 480,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					tabIndex: 0,
					title: path,
					className: SkillsSection_module_css_default.location,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: path })
				})
			});
		}
		var SkillsErrorBoundary = class extends react.Component {
			state = {};
			static getDerivedStateFromError(error) {
				return { error };
			}
			render() {
				if (this.state.error !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: SkillsSection_module_css_default.page,
					role: "alert",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: SkillsSection_module_css_default.error,
						children: [
							this.props.t("errors.render"),
							": ",
							this.state.error.message
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						size: "sm",
						onClick: () => this.setState({ error: void 0 }),
						children: this.props.t("detail.back")
					})]
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: this.props.children });
			}
		};
		function formatError(t, key, error) {
			const detail = error instanceof Error ? error.message : String(error);
			return `${t(key)}: ${detail}`;
		}
		//#endregion
		//#region src/client/locale.ts
		/** Locale dictionaries for the Skills Manager settings surface. */
		/** Namespace owned by this plugin. */
		const SKILLS_MANAGER_NS = "dsh-skills-manager";
		/** Simplified Chinese dictionary and the source of truth for the key set. */
		const zh = {
			"nav.title": "技能",
			"toolbar.searchPlaceholder": "搜索技能...",
			"toolbar.conflicts": "冲突",
			"toolbar.scanExternal": "扫描外部技能",
			"toolbar.newSkill": "新建技能",
			"toolbar.openSkillsFolder": "打开技能目录",
			"toolbar.openSkillsFolderUnavailable": "当前环境不支持打开本地目录",
			"table.name": "名称",
			"table.description": "描述",
			"table.scope": "范围",
			"table.location": "路径",
			"table.actions": "操作",
			"table.view": "查看",
			"table.edit": "编辑",
			"table.delete": "删除",
			"table.empty": "未找到技能",
			"table.locationUnavailable": "无路径",
			"text.expand": "展开",
			"text.collapse": "收起",
			"actions.label": "更多操作",
			"status.loading": "正在加载技能…",
			"status.yes": "是",
			"status.no": "否",
			"detail.back": "返回",
			"detail.description": "描述",
			"detail.whenToUse": "使用场景",
			"detail.source": "来源",
			"detail.provider": "提供方",
			"detail.location": "路径",
			"detail.modelInvocable": "模型可调用",
			"detail.userInvocable": "用户可调用",
			"detail.edit": "编辑",
			"editor.newTitle": "新建技能",
			"editor.editTitle": "编辑 {name}",
			"editor.name": "名称",
			"editor.namePlaceholder": "kebab-case-skill-name",
			"editor.scope": "范围",
			"editor.global": "全局",
			"editor.project": "项目",
			"editor.description": "描述",
			"editor.whenToUse": "使用场景（可选）",
			"editor.body": "SKILL.md 内容",
			"editor.cancel": "取消",
			"editor.save": "保存",
			"import.title": "外部技能导入",
			"import.overview.title": "概览",
			"import.records.title": "记录",
			"import.back": "返回",
			"import.scanAgain": "重新扫描",
			"import.viewDetails": "查看详情",
			"import.summary.scanned": "扫描候选",
			"import.summary.inDsh": "已在 DSH",
			"import.summary.deduplicated": "去重副本",
			"import.summary.conflicts": "冲突",
			"import.summary.invalid": "无效",
			"import.lastScan": "最近扫描：{time}",
			"import.details.title": "最近一次扫描",
			"import.details.scanned": "扫描候选",
			"import.details.uniqueValid": "唯一有效技能",
			"import.details.inDsh": "已在 DSH",
			"import.details.importedThisScan": "本次新增",
			"import.details.deduplicated": "去重副本",
			"import.details.conflicts": "冲突",
			"import.details.invalid": "无效",
			"import.details.failed": "导入失败",
			"import.breakdown.title": "去重副本明细",
			"import.breakdown.samePath": "相同物理路径",
			"import.breakdown.sameContent": "相同内容",
			"import.breakdown.alreadyInDsh": "DSH 已存在",
			"import.breakdown.total": "共过滤",
			"import.unitNote": "“已在 DSH”按唯一技能统计，“去重副本”按扫描候选副本统计。",
			"import.groups.title": "按技能聚合",
			"import.groups.status": "状态",
			"import.groups.sources": "外部来源",
			"import.groups.candidates": "外部候选",
			"import.groups.uniqueSkill": "唯一技能",
			"import.groups.result": "结果",
			"import.groups.statusInDsh": "已在 DSH",
			"import.groups.statusNotInDsh": "未进入 DSH",
			"import.groups.resultImported": "本次已导入",
			"import.groups.resultMerged": "已合并为 1 个唯一技能，无需重复导入",
			"import.conflictsTitle": "导入冲突",
			"import.noPendingConflicts": "没有待处理的冲突。",
			"import.dshExisting": "DSH 已有版本",
			"import.use": "使用 {label}",
			"import.noItems": "没有项目。",
			"import.filter.all": "全部",
			"import.filter.new": "新增",
			"import.filter.duplicate": "去重副本",
			"import.filter.conflict": "冲突",
			"import.filter.invalid": "无效",
			"import.filter.skipped": "未导入",
			"import.result.new": "新增",
			"import.result.duplicate": "去重副本",
			"import.result.conflict": "冲突",
			"import.result.invalid": "无效",
			"import.result.skipped": "未导入",
			"delete.title": "删除“{name}”？",
			"delete.warning": "此操作无法撤销。只会删除 DSH 管理的技能，不会修改外部源文件。",
			"delete.cancel": "取消",
			"delete.confirm": "删除",
			"dialog.close": "关闭",
			"errors.load": "加载技能失败",
			"errors.get": "加载技能详情失败",
			"errors.save": "保存技能失败",
			"errors.delete": "删除技能失败",
			"errors.scan": "扫描外部技能失败",
			"errors.resolve": "处理冲突失败",
			"errors.openSkillsDirectory": "打开技能目录失败",
			"errors.incompatibleHost": "当前 DSH 版本不支持 Skills 管理界面",
			"errors.render": "Skills 管理界面加载失败"
		};
		/** English dictionary, checked against the Chinese key set. */
		const en = {
			"nav.title": "Skills",
			"toolbar.searchPlaceholder": "Search skills...",
			"toolbar.conflicts": "Conflicts",
			"toolbar.scanExternal": "Scan External Skills",
			"toolbar.newSkill": "New Skill",
			"toolbar.openSkillsFolder": "Open skills folder",
			"toolbar.openSkillsFolderUnavailable": "Opening local folders is unavailable in the current environment.",
			"table.name": "Name",
			"table.description": "Description",
			"table.scope": "Scope",
			"table.location": "Location",
			"table.actions": "Actions",
			"table.view": "View",
			"table.edit": "Edit",
			"table.delete": "Delete",
			"table.empty": "No skills found.",
			"table.locationUnavailable": "No path",
			"text.expand": "More",
			"text.collapse": "Less",
			"actions.label": "More actions",
			"status.loading": "Loading skills…",
			"status.yes": "yes",
			"status.no": "no",
			"detail.back": "Back",
			"detail.description": "Description",
			"detail.whenToUse": "When to use",
			"detail.source": "Source",
			"detail.provider": "Provider",
			"detail.location": "Location",
			"detail.modelInvocable": "Model invocable",
			"detail.userInvocable": "User invocable",
			"detail.edit": "Edit",
			"editor.newTitle": "New Skill",
			"editor.editTitle": "Edit {name}",
			"editor.name": "Name",
			"editor.namePlaceholder": "kebab-case-skill-name",
			"editor.scope": "Scope",
			"editor.global": "Global",
			"editor.project": "Project",
			"editor.description": "Description",
			"editor.whenToUse": "When to use (optional)",
			"editor.body": "SKILL.md body",
			"editor.cancel": "Cancel",
			"editor.save": "Save",
			"import.title": "External Skills Import",
			"import.overview.title": "Overview",
			"import.records.title": "Records",
			"import.back": "Back",
			"import.scanAgain": "Scan Again",
			"import.viewDetails": "View Details",
			"import.summary.scanned": "Scanned",
			"import.summary.inDsh": "In DSH",
			"import.summary.deduplicated": "Deduplicated",
			"import.summary.conflicts": "Conflicts",
			"import.summary.invalid": "Invalid",
			"import.lastScan": "Last scan: {time}",
			"import.details.title": "Most recent scan",
			"import.details.scanned": "Scanned candidates",
			"import.details.uniqueValid": "Unique valid skills",
			"import.details.inDsh": "In DSH",
			"import.details.importedThisScan": "Imported this scan",
			"import.details.deduplicated": "Deduplicated",
			"import.details.conflicts": "Conflicts",
			"import.details.invalid": "Invalid",
			"import.details.failed": "Import failed",
			"import.breakdown.title": "Deduplicated breakdown",
			"import.breakdown.samePath": "Same physical path",
			"import.breakdown.sameContent": "Same content",
			"import.breakdown.alreadyInDsh": "Already in DSH",
			"import.breakdown.total": "Total filtered",
			"import.unitNote": "“In DSH” counts unique skills, while “Deduplicated” counts filtered candidate copies.",
			"import.groups.title": "Grouped by skill",
			"import.groups.status": "Status",
			"import.groups.sources": "External sources",
			"import.groups.candidates": "External candidates",
			"import.groups.uniqueSkill": "Unique skills",
			"import.groups.result": "Result",
			"import.groups.statusInDsh": "In DSH",
			"import.groups.statusNotInDsh": "Not in DSH",
			"import.groups.resultImported": "Imported this scan",
			"import.groups.resultMerged": "Merged into 1 unique skill; no re-import needed",
			"import.conflictsTitle": "Import Conflicts",
			"import.noPendingConflicts": "No pending conflicts.",
			"import.dshExisting": "DSH existing",
			"import.use": "Use {label}",
			"import.noItems": "No items.",
			"import.filter.all": "All",
			"import.filter.new": "New",
			"import.filter.duplicate": "Deduplicated",
			"import.filter.conflict": "Conflict",
			"import.filter.invalid": "Invalid",
			"import.filter.skipped": "Not imported",
			"import.result.new": "New",
			"import.result.duplicate": "Deduplicated",
			"import.result.conflict": "Conflict",
			"import.result.invalid": "Invalid",
			"import.result.skipped": "Not imported",
			"delete.title": "Delete “{name}”?",
			"delete.warning": "This action cannot be undone. Only the DSH-managed skill will be removed; external source files are never touched.",
			"delete.cancel": "Cancel",
			"delete.confirm": "Delete",
			"dialog.close": "Close",
			"errors.load": "Failed to load skills",
			"errors.get": "Failed to load skill details",
			"errors.save": "Failed to save skill",
			"errors.delete": "Failed to delete skill",
			"errors.scan": "Failed to scan external skills",
			"errors.resolve": "Failed to resolve conflict",
			"errors.openSkillsDirectory": "Failed to open skills folder",
			"errors.incompatibleHost": "This DSH version does not support the Skills Manager UI",
			"errors.render": "The Skills Manager UI failed to load"
		};
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"slots",
			"locale",
			"connection",
			"remote"
		];
		function apply(ctx) {
			if (!isClientContextCompatible(ctx)) return;
			ctx.effect(() => ctx.locale.register(SKILLS_MANAGER_NS, {
				zh,
				en
			}), "dsh-skills-manager: dictionaries");
			const t = ctx.locale.bind(SKILLS_MANAGER_NS);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "skills",
				order: 20,
				label: () => t("nav.title"),
				locale: SKILLS_MANAGER_NS,
				inject: () => ({
					api: skillsManagerApi,
					connection: ctx.get("connection"),
					remote: ctx.get("remote")
				})
			}, SkillsSection));
		}
		//#endregion
		exports.SKILLS_MANAGER_NS = SKILLS_MANAGER_NS;
		exports.apply = apply;
		exports.en = en;
		exports.inject = inject;
		exports.zh = zh;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map