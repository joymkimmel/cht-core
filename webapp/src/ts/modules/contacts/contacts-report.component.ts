import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '@ngrx/store';
import { combineLatest, Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { ContactsActions } from '@mm-actions/contacts';
import { GlobalActions } from '@mm-actions/global';
import { EnketoService } from '@mm-services/enketo.service';
import { GeolocationService } from '@mm-services/geolocation.service';
import { Selectors } from '@mm-selectors/index';
import { TelemetryService } from '@mm-services/telemetry.service';
import { XmlFormsService } from '@mm-services/xml-forms.service';
import { TranslateFromService } from '@mm-services/translate-from.service';

@Component({
  templateUrl: './contacts-report.component.html'
})
export class ContactsReportComponent implements OnInit, OnDestroy{
  private globalActions;
  private contactsActions;
  private geoHandle:any;
  private routeSnapshot;
  private telemetryData:any = {
    preRender: Date.now()
  };

  subscription: Subscription = new Subscription();
  enketoStatus;
  enketoSaving;
  enketoError;
  selectedContact;
  form;
  loadingForm;
  errorTranslationKey;
  contentError;
  contactId;
  formId;

  constructor(
    private store: Store,
    private enketoService: EnketoService,
    private geolocationService: GeolocationService,
    private telemetryService: TelemetryService,
    private xmlFormsService: XmlFormsService,
    private translateFromService: TranslateFromService,
    private router: Router,
    private route: ActivatedRoute,
    private translateService: TranslateService,
  ){
    this.globalActions = new GlobalActions(store);
    this.contactsActions = new ContactsActions(store);
  }

  ngOnInit() {
    this.subscribeToStore();
    this.subscribeToRoute();

    this.geoHandle = this.geolocationService.init();
    this.resetFormError();
    this.form = null;
    this.loadingForm = true;
    // this.clearRightActionBar();
    this.globalActions.setShowContent(true);
    this.setCancelCallback();

    this.render(this.contactId, this.formId);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.geoHandle && this.geoHandle.cancel();
    this.enketoService.unload(this.form);
  }

  private markFormEdited() {
    this.globalActions.setEnketoEditedStatus(true);
  }

  private resetFormError() {
    if (this.enketoError) {
      this.globalActions.setEnketoError.setEnketoError(null);
    }
  }

  private subscribeToStore() {
    const reduxSubscription = combineLatest(
      this.store.select(Selectors.getEnketoStatus),
      this.store.select(Selectors.getEnketoSavingStatus),
      this.store.select(Selectors.getEnketoError),
      this.store.select(Selectors.getSelectedContact),
    ).subscribe(([ enketoStatus, enketoSaving, enketoError, selectedContact]) => {
      this.enketoStatus = enketoStatus;
      this.enketoSaving = enketoSaving;
      this.enketoError = enketoError;
      this.selectedContact = selectedContact;
    });
    this.subscription.add(reduxSubscription);
  }

  private subscribeToRoute() {
    const routeSubscription = this.route.params.subscribe((params) => {
      // if (_isEqual(this.routeSnapshot.params, params)) {
      //   // the 1st time we load the form, we must wait for the view to be initialized
      //   // if we don't skip, it will result in the form being loaded twice
      //   return;
      // }
      this.routeSnapshot = this.route.snapshot;
      this.contactId = params.id;
      this.formId = params.formId;
    });
    this.subscription.add(routeSubscription);
  }

  private setCancelCallback() {
    this.routeSnapshot = this.route.snapshot;
    if (this.routeSnapshot.params && (this.routeSnapshot.params.id || this.routeSnapshot.params.formId)) {
      this.globalActions.setCancelCallback(() => {
        if (this.routeSnapshot.params.id) {
          this.router.navigate(['/contacts', this.routeSnapshot.params.idd]);
        } else {
          this.router.navigate(['/contacts']);
        }
      });
    } else {
      this.globalActions.clearCancelCallback();
    }
  }

  navigationCancel() {
    this.globalActions.navigationCancel();
  }

  render(contactId, formId) {
    this.contactsActions.setSelectedContact(contactId, { merge: true })
      .then(() => {
        this.setCancelCallback();
        return this.xmlFormsService.get(formId);
      })
      .then((form) => {
        const instanceData = {
          source: 'contact',
          contact: this.selectedContact.doc,
        };
        this.globalActions.setEnketoEditedStatus(false);
        this.globalActions.setTitle(this.translateFromService.get(form.title));
        return this.enketoService.render(
          '#contact-report',
          form, instanceData,
          this.markFormEdited,
          this.resetFormError
        );
      })
      .then((formInstance) => {
        this.form = formInstance;
        this.loadingForm = false;
        this.telemetryData.postRender = Date.now();
        this.telemetryData.form = formId;

        this.telemetryService.record(
          `enketo:contacts:${this.telemetryData.form}:add:render`,
          this.telemetryData.postRender - this.telemetryData.preRender);
      })
      .catch(err => {
        console.error('Error loading form', err);
        this.errorTranslationKey = err.translationKey || 'error.loading.form';
        this.contentError = true;
        this.loadingForm = false;
      });
  }

  save() {
    if (this.enketoSaving) {
      console.debug('Attempted to call "contacts-report.save" more than once');
      return;
    }

    this.telemetryData.preSave = Date.now();
    this.telemetryService.record(
      `enketo:contacts:${this.telemetryData.form}:add:user_edit_time`,
      this.telemetryData.preSave - this.telemetryData.postRender);

    this.globalActions.setEnketoSavingStatus(true);
    this.resetFormError();
    this.enketoService.save(this.formId, this.form, this.geoHandle)
      .then((docs) => {
        console.debug('saved report and associated docs', docs);
        this.globalActions.setEnketoSavingStatus(false);
        this.globalActions.setSnackbarContent(this.translateService.instant('report.created'));
        this.globalActions.setEnketoEditedStatus(false);
        this.router.navigate([`/contacts/${this.contactId}`]);
      })
      .then(() => {
        this.telemetryData.postSave = Date.now();

        this.telemetryService.record(
          `enketo:contacts:${this.telemetryData.form}:add:save`,
          this.telemetryData.postSave - this.telemetryData.preSave);
      })
      .catch((err) => {
        this.globalActions.setEnketoSavingStatus(false);
        console.error('Error submitting form data: ', err);
        // this.translateService.get('error.report.save').then((msg) => {
        //   this.globalActions.setEnketoError(msg);
        // });
      });
  }
}