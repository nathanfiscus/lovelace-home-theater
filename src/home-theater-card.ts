import { LitElement, html, customElement, property, CSSResult, TemplateResult, css, PropertyValues } from 'lit-element';
import {
  HomeAssistant,
  hasConfigOrEntityChanged,
  hasAction,
  ActionHandlerEvent,
  handleAction,
  LovelaceCardEditor,
  getLovelace,
  LovelaceCard,
} from 'custom-card-helpers';

import './editor';

import { HomeTheaterCardConfig } from './types';
import { actionHandler } from './action-handler-directive';
import { CARD_VERSION } from './const';

import { localize } from './localize/localize';

/* eslint no-console: 0 */
console.info(
  `%c  HOME-THEATER-CARED \n%c  ${localize('common.version')} ${CARD_VERSION}    `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'home-theater-card',
  name: 'Home Theater Card',
  description: 'A custom card for home theater systems with multiple sources',
});

// TODO Name your custom element
@customElement('home-theater-card')
export class HomeTheaterCard extends LitElement {
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('home-theater-card-editor') as LovelaceCardEditor;
  }

  public static getStubConfig(): object {
    return {
      sources: [],
    };
  }

  // TODO Add any properities that should cause your element to re-render here
  @property() public hass!: HomeAssistant;
  @property() private _config!: HomeTheaterCardConfig;
  @property() private _configElement!: LovelaceCardEditor;

  public setConfig(config: HomeTheaterCardConfig): void {
    // TODO Check for required fields and that they are of the proper format
    if (!config || config.show_error) {
      throw new Error(localize('common.invalid_configuration'));
    }

    if (!config.entity) {
      throw new Error(localize('common.invalid_configuration'));
    }

    if (config.test_gui) {
      getLovelace().setEditMode(true);
    }

    this._config = {
      name: 'Home Theater',
      ...config,
    };
  }

  protected shouldUpdate(): boolean {
    return true;
    //return hasConfigOrEntityChanged(this, changedProps, false);
  }

  togglePowerAVR = (): void => {
    if (!this._config.entity) {
      throw Error(`Invalid entity: ${this._config.entity}`);
    }

    const entity = this.hass.states[this._config.entity];
    if (!entity) throw Error(`Invalid entity: ${this._config.entity}`);

    if (entity.state === 'on') {
      this._config.sources.forEach(source => {
        if (source.source_entity) {
          const source_entity = this.hass.states[source.source_entity];
          if (source_entity && source_entity.state !== 'off') {
            this.hass.callService('media_player', 'turn_off', { entity_id: source_entity.entity_id });
          } else {
            console.error(`Source Entity ${source.source_entity} is not found!`);
          }
        }
      });
    }

    this.hass.callService('media_player', 'toggle', { entity_id: entity.entity_id });
  };

  switchAVRSource = (source: string) => (): void => {
    if (!this._config.entity) {
      throw Error(`Invalid entity: ${this._config.entity}`);
    }

    const entity = this.hass.states[this._config.entity];
    if (!entity) throw Error(`Invalid entity: ${this._config.entity}`);

    const CURRENT_CUSTOM_SOURCE_CONFIG = this._config.sources.find((custom: any) => custom.source === source) || {};

    if (CURRENT_CUSTOM_SOURCE_CONFIG.source_entity) {
      const source_entity = this.hass.states[CURRENT_CUSTOM_SOURCE_CONFIG.source_entity];
      if (source_entity && source_entity.state !== 'on') {
        this.hass.callService('media_player', 'turn_on', { entity_id: source_entity.entity_id });
      } else {
        console.error(`Source Entity ${CURRENT_CUSTOM_SOURCE_CONFIG.source_entity} is not found!`);
      }
    }
    if (entity.attributes.source !== source) {
      this.hass.callService('media_player', 'select_source', { entity_id: entity.entity_id, source });
    }
  };

  changeAVRVolume = (e): void => {
    const value = e.currentTarget.value;
    if (!this._config.entity) {
      throw Error(`Invalid entity: ${this._config.entity}`);
    }

    const entity = this.hass.states[this._config.entity];
    if (!entity) throw Error(`Invalid entity: ${this._config.entity}`);

    this.hass.callService('media_player', 'volume_set', {
      entity_id: entity.entity_id,
      volume_level: value / 100,
    });
  };

  toggleTVPower = (): void => {
    const entity = this.hass.states[this._config.tv_entity];
    if (!entity) throw Error(`Invalid entity: ${this._config.tv_entity}`);

    this.hass.callService('media_player', 'toggle', { entity_id: entity.entity_id });
  };

  toggleMuteAVR = (): void => {
    if (!this._config.entity) {
      throw Error(`Invalid entity: ${this._config.entity}`);
    }

    const entity = this.hass.states[this._config.entity];
    if (!entity) throw Error(`Invalid entity: ${this._config.entity}`);

    this.hass.callService('media_player', 'volume_mute', {
      entity_id: entity.entity_id,
      is_volume_muted: !entity.attributes.is_volume_muted,
    });
  };

  handleSoundModeChange = (e): void => {
    const value = e.detail.value;
    if (!this._config.entity) {
      throw Error(`Invalid entity: ${this._config.entity}`);
    }

    const entity = this.hass.states[this._config.entity];
    if (!entity) throw Error(`Invalid entity: ${this._config.entity}`);

    if (entity.attributes.sound_mode !== value) {
      this.hass.callService('media_player', 'select_sound_mode', {
        entity_id: entity.entity_id,
        sound_mode: value,
      });
    }
  };

  protected render(): TemplateResult | void {
    // TODO Check for stateObj or other necessary things and render a warning if missing
    if (this._config.show_warning) {
      return this.showWarning(localize('common.show_warning'));
    }

    if (!this._config.entity) {
      throw Error(`Invalid entity: ${this._config.entity}`);
    }

    const entity = this.hass.states[this._config.entity];
    const tv_entity = this.hass.states[this._config.tv_entity];
    if (!entity) throw Error(`Invalid entity: ${this._config.entity}`);

    this.adoptStyles;

    const CURRENT_CUSTOM_SOURCE_CONFIG =
      this._config.sources.find(custom => custom.source === entity.attributes.source) || {};

    // const SORTED_SOURCES = [...entity.attributes['source_list']].sort((a: string, b: string) => {
    //   const aconfig = this._config.sources.find(custom => custom.source === a);
    //   const bconfig = this._config.sources.find(custom => custom.source === b);
    //   let aIndex = this._config.sources.findIndex(custom => custom.source === a);
    //   let bIndex = this._config.sources.findIndex(custom => custom.source === b);
    //   if (!aconfig.visible) {
    //     return -1;
    //   }
    //   if (aIndex < 0) {
    //     aIndex = 99;
    //   }
    //   if (bIndex < 0) {
    //     bIndex = 99;
    //   }
    //   if (aIndex > bIndex) {
    //     return 1;
    //   } else if (aIndex < bIndex) {
    //     return -1;
    //   } else {
    //     if (aconfig && bconfig) {
    //       return 0;
    //     } else {
    //       if (a < b) {
    //         return 1;
    //       } else if (a > b) {
    //         return -1;
    //       } else {
    //         return 0;
    //       }
    //     }
    //   }
    // });

    const IS_ON = entity.state === 'on';

    return html`
      <ha-card tabindex="0" aria-label=${`HomeTheater: ${this._config.entity}`}>
        <div class="media-image">
          <img
            style="width:100%;"
            src=${`${CURRENT_CUSTOM_SOURCE_CONFIG.default_source_img || '/local/avr-sources/default.png'}`}
          />
          <!--<paper-progress .max=${100} .min=${0} .value=${entity.attributes.volume_level * 100}></paper-progress>-->
          <div class="home-theater-footer">
            ${this._config.name}
            <div class="control-wrapper">
              <mwc-icon-button label="Power" .onclick=${this.togglePowerAVR}>
                <ha-icon icon="mdi:power" style="margin-top: -8px;"></ha-icon>
              </mwc-icon-button>
              ${entity.state !== 'on'
                ? ''
                : html`
                    <div class="vertical-divider"></div>
                  `}
              <div class="source-wrapper">
                ${entity.state !== 'on'
                  ? ''
                  : this._config.sources.map(s => {
                      if (s.visible !== false) {
                        if (s.icon) {
                          return html`
                            <mwc-icon-button .label=${s.name} .onclick=${this.switchAVRSource(s.source)}>
                              <ha-icon
                                class=${s.source === entity.attributes.source ? 'selected-source' : ''}
                                .icon=${s.icon}
                                style="margin-top: -8px;"
                              ></ha-icon>
                            </mwc-icon-button>
                          `;
                        } else {
                          return html`
                            <button
                              class=${s === entity.attributes.source ? 'selected-source' : ''}
                              .onclick=${this.switchAVRSource(s.source)}
                            >
                              ${s.name}
                            </button>
                          `;
                        }
                      }
                      return null;
                    })}
              </div>
            </div>
          </div>
        </div>
        <div class="volume-controls">
          ${!tv_entity
            ? ''
            : html`
                <mwc-icon-button .onclick=${this.toggleTVPower}>
                  <ha-icon
                    class=${tv_entity.state === 'on' ? 'selected-source' : ''}
                    icon="mdi:television"
                    style="margin-top: -8px;"
                  ></ha-icon>
                </mwc-icon-button>
              `}
          ${!IS_ON
            ? ''
            : html`
                <mwc-icon-button .onclick=${this.toggleMuteAVR}>
                  <ha-icon
                    .icon=${entity.attributes.is_volume_muted ? 'mdi:volume-mute' : 'mdi:volume-high'}
                    style="margin-top: -8px;"
                  ></ha-icon>
                </mwc-icon-button>
                <ha-slider
                  pin
                  max=${100}
                  min=${0}
                  .value=${entity.attributes.volume_level * 100}
                  .onchange=${this.changeAVRVolume}
                ></ha-slider>
                <ha-paper-dropdown-menu label-float dynamic-align label="Sound Mode">
                  <paper-listbox
                    slot="dropdown-content"
                    attr-for-selected="item-name"
                    .selected=${entity.attributes.sound_mode}
                    @selected-changed=${this.handleSoundModeChange}
                  >
                    ${entity.attributes.sound_mode_list.map(
                      (mode: string) => html`
                        <paper-item item-name=${mode}>
                          ${mode}
                        </paper-item>
                      `,
                    )}
                  </paper-listbox>
                </ha-paper-dropdown-menu>
              `}
        </div>
      </ha-card>
    `;
  }

  private showWarning(warning: string): TemplateResult {
    return html`
      <hui-warning>${warning}</hui-warning>
    `;
  }

  private showError(error: string): TemplateResult {
    const errorCard = document.createElement('hui-error-card') as LovelaceCard;
    errorCard.setConfig({
      type: 'error',
      error,
      origConfig: this._config,
    });

    return html`
      ${errorCard}
    `;
  }

  static get styles(): CSSResult {
    return css`
      .home-theater-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: rgba(0, 0, 0, 0.3);
        padding: 8px 8px;
        position: absolute;
        bottom: 0px;
        left: 0px;
        right: 0px;
        z-index: 1;
        flex-wrap: wrap;
      }
      .control-wrapper {
        display: flex;
        align-items: center;
        white-space: nowrap;
        flex: 1 1 auto;
        justify-content: space-around;
      }
      .media-image {
        position: relative;
      }
      .vertical-divider {
        border-right: 1px rgba(0, 0, 0, 0.2) solid;
        height: 32px;
        flex: 0 0 0px;
        margin: 0px 8px 0px 8px;
      }
      .volume-controls {
        display: flex;
        align-items: center;
        padding: 8px 8px;
      }
      .volume-controls > :nth-child(3) {
        flex: 1 1 100%;
      }
      .selected-source {
        color: var(--paper-item-icon-active-color);
      }
    `;
  }
}
