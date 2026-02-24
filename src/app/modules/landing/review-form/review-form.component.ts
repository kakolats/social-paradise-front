import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-review-form',
  standalone: true,
  imports: [],
  templateUrl: './review-form.component.html',
  styleUrl: './review-form.component.scss'
})
export class ReviewFormComponent {
    formUrl: SafeResourceUrl;

    // Replace with your Google Forms embed URL
    private readonly rawUrl =
        'https://docs.google.com/forms/d/e/1FAIpQLSd6TcML1eewZztPIBD5uzgz11_dFOzpE37bCjsvVIuhnEzr2Q/viewform?embedded=true';

    constructor(private sanitizer: DomSanitizer) {
        this.formUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.rawUrl);
    }
}
