import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@no996/ui/field'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@no996/ui/card'
import { ArrowRightIcon, Building2Icon, ChevronDownIcon } from 'lucide-react'
import type { CompanyProfileFormData } from '../../../services/persona'

type Props = {
  isConfigured: boolean
  initialData: CompanyProfileFormData
  onSubmit: (data: CompanyProfileFormData) => void
  onCancel?: () => void
}

export function CompanyFormView({ isConfigured, initialData, onSubmit, onCancel }: Props) {
  const { t } = useTranslation('persona')
  const [formData, setFormData] = useState<CompanyProfileFormData>(initialData)
  const [errors, setErrors] = useState<Partial<Record<keyof CompanyProfileFormData, string>>>({})
  const [showOptional, setShowOptional] = useState(false)

  function validate() {
    const errs: Partial<Record<keyof CompanyProfileFormData, string>> = {}
    if (!formData.companyName.trim()) errs.companyName = t('companyForm.companyNameRequired')
    if (!formData.industry.trim()) errs.industry = t('companyForm.industryRequired')
    if (!formData.mainBusiness.trim()) errs.mainBusiness = t('companyForm.mainBusinessRequired')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  return (
    <Card className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (validate()) onSubmit(formData)
        }}
      >
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Building2Icon className="h-4 w-4 text-primary" />
            {t('companyForm.title')}
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            {t('companyForm.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5 pb-6">
          <FieldGroup>
            <Field data-invalid={Boolean(errors.companyName)}>
              <FieldLabel htmlFor="cp-name">
                {t('companyForm.companyName')} <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="cp-name"
                value={formData.companyName}
                placeholder={t('companyForm.companyNamePlaceholder')}
                onChange={(e) => {
                  setFormData({ ...formData, companyName: e.target.value })
                  if (errors.companyName) setErrors({ ...errors, companyName: undefined })
                }}
              />
              {errors.companyName ? <FieldError>{errors.companyName}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(errors.industry)}>
              <FieldLabel htmlFor="cp-industry">
                {t('form.industry')} <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="cp-industry"
                value={formData.industry}
                placeholder={t('form.industryPlaceholder')}
                onChange={(e) => {
                  setFormData({ ...formData, industry: e.target.value })
                  if (errors.industry) setErrors({ ...errors, industry: undefined })
                }}
              />
              {errors.industry ? <FieldError>{errors.industry}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(errors.mainBusiness)}>
              <FieldLabel htmlFor="cp-business">
                {t('form.primaryBusiness')} <span className="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                id="cp-business"
                rows={3}
                value={formData.mainBusiness}
                placeholder={t('companyForm.mainBusinessPlaceholder')}
                onChange={(e) => {
                  setFormData({ ...formData, mainBusiness: e.target.value })
                  if (errors.mainBusiness) setErrors({ ...errors, mainBusiness: undefined })
                }}
              />
              {errors.mainBusiness ? <FieldError>{errors.mainBusiness}</FieldError> : null}
            </Field>
            <div className="pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground gap-1"
                onClick={() => setShowOptional((v) => !v)}
              >
                <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showOptional ? 'rotate-180' : ''}`} />
                {t('form.moreOptional')}
              </Button>
            </div>
            {showOptional ? (
              <div className="brain-form-optional">
                <Field>
                  <FieldLabel htmlFor="cp-market">
                    {t('companyForm.targetMarket')} <span className="text-xs text-muted-foreground">({t('form.optional')})</span>
                  </FieldLabel>
                  <Input
                    id="cp-market"
                    value={formData.targetMarket ?? ''}
                    onChange={(e) => setFormData({ ...formData, targetMarket: e.target.value })}
                  />
                  <FieldDescription>{t('companyForm.targetMarketHint')}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="cp-edge">
                    {t('companyForm.competitiveEdge')} <span className="text-xs text-muted-foreground">({t('form.optional')})</span>
                  </FieldLabel>
                  <Textarea
                    id="cp-edge"
                    rows={2}
                    value={formData.competitiveEdge ?? ''}
                    onChange={(e) => setFormData({ ...formData, competitiveEdge: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cp-vision">
                    {t('companyForm.companyVision')} <span className="text-xs text-muted-foreground">({t('form.optional')})</span>
                  </FieldLabel>
                  <Input
                    id="cp-vision"
                    value={formData.companyVision ?? ''}
                    onChange={(e) => setFormData({ ...formData, companyVision: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cp-additional">
                    {t('form.additionalInfo')} <span className="text-xs text-muted-foreground">({t('form.optional')})</span>
                  </FieldLabel>
                  <Textarea
                    id="cp-additional"
                    rows={2}
                    value={formData.additionalInfo ?? ''}
                    onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
                  />
                </Field>
              </div>
            ) : null}
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-3">
          {isConfigured && onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t('cancel')}
            </Button>
          ) : null}
          <Button type="submit" className="min-w-[7.5rem] gap-2">
            {isConfigured ? t('companyForm.updatePreview') : t('companyForm.generate') }
            <ArrowRightIcon className="size-4" />
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
