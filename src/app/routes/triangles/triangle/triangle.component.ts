import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core'
import { debounce, filter, flatten, range } from 'lodash'
import { takeUntil } from 'rxjs/operators'
import { TrianglesService } from '../triangles.service'
import { DestroyerComponent } from '../../../utils/destroyer.component'
import { Counter } from './counter'
import { triangle } from '../../../utils/triangle'
import { TriangleCounterValueService } from './triangle-counter-value.service'
import { TriangleCounterValues } from './triangle-counter-values.enum'
import { TriangleToolboxMessage } from '../triangle-toolbox/triangle-toolbox-message.enum'
import { ColorService } from '../../../reusable/color/color.service'
import { bignumber } from 'mathjs'

@Component({
  selector: 'app-triangle',
  templateUrl: './triangle.component.html',
  styleUrls: ['./triangle.component.scss']
})

export class TriangleComponent extends DestroyerComponent implements OnInit, OnChanges, OnDestroy {

  @Input() rowCount = 1

  alignCenter = true
  color: string
  mode: string
  counterValues: TriangleCounterValues
  countersWaitingToSpin = []
  spinInterval

  rows: Array<Array<Counter>> = []

  constructor(private trianglesService: TrianglesService, private triangleCounterValueService: TriangleCounterValueService,
              private colorService: ColorService) {
    super()
    this.colorsChange = debounce(this.colorsChange, 300, {leading: false, trailing: true})
  }

  ngOnInit() {
    this.spinInterval = setInterval(() => {
      this.countersWaitingToSpin.forEach(counter => {
        counter.spin = true
      })
      this.countersWaitingToSpin = []
    }, 2000) // interval must be same as .spin duration

    this.trianglesService.triangleToolboxMessage$.pipe(
      takeUntil(this.unsubscribe$)
    ).subscribe((message) => {
      switch (message.name) {
        case TriangleToolboxMessage.ChangeColor:
          this.color = message.value
          break
        case TriangleToolboxMessage.ChangeCounterValues:
          this.counterValues = message.value
          this.updateCounterValues()
          break
        case TriangleToolboxMessage.ChangeMode:
          this.clearActive()
          this.mode = message.value
          break
        case TriangleToolboxMessage.ClearActive:
          this.clearActive()
          break
        case TriangleToolboxMessage.ClearSelected:
          this.clearSelected()
          break
        case TriangleToolboxMessage.ToggleAlign:
          this.alignCenter = message.value
          break
      }
    })

    const rng = range(1, this.rowCount + 1)
    rng.forEach((row) => {
      this.addRow(row)
    })
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.rowCount && !changes.rowCount.firstChange) {
      if (changes.rowCount.currentValue > changes.rowCount.previousValue) {
        for (let i = changes.rowCount.previousValue + 1; i <= changes.rowCount.currentValue; i++) this.addRow(i)
      }
      if (changes.rowCount.currentValue < changes.rowCount.previousValue) {
        for (let i = changes.rowCount.previousValue - 1; i >= changes.rowCount.currentValue; i--) this.removeRow()
        this.colorsChange()
      }
    }
  }

  ngOnDestroy() {
    clearInterval(this.spinInterval)
    super.ngOnDestroy()
  }

  private clearActive() {
    const allCounters = flatten(this.rows)
    const counters = filter(allCounters, {active: true})
    counters.forEach(counter => counter.active = false)
  }

  private clearSelected() {
    const allCounters = flatten(this.rows)
    const counters = filter(allCounters, counter => counter.color != null)
    counters.forEach(counter => counter.color = null)
    this.colorsChange()
  }

  private updateCounterValues() {
    const allCounters = flatten(this.rows)
    allCounters.forEach(counter => {
      counter.value = this.triangleCounterValueService.getCounterValue(counter, this.counterValues)
    })
    this.colorsChange()
  }

  onCounterClick(counter) {
    counter.spin = false
    switch (this.mode) {
      case 'paint':
        counter.color = counter.color === this.color ? null : this.color
        this.colorsChange()
        break
      case 'line':
        this.setCounterActivation(counter, !counter.active)
        break
      case 'fill':
        console.log('fill')
        break
    }
  }

  private colorsChange() {
    const allCounters = flatten(this.rows)
    const appRed = filter(allCounters, {color: 'appRed'})
    const appYellow = filter(allCounters, {color: 'appYellow'})
    const appPink = filter(allCounters, {color: 'appPink'})
    const appGreen = filter(allCounters, {color: 'appGreen'})
    const appOrange = filter(allCounters, {color: 'appOrange'})
    const appBlue = filter(allCounters, {color: 'appBlue'})
    const appRedValue = this.getValueSum(appRed)
    const appYellowValue = this.getValueSum(appYellow)
    const appPinkValue = this.getValueSum(appPink)
    const appGreenValue = this.getValueSum(appGreen)
    const appOrangeValue = this.getValueSum(appOrange)
    const appBlueValue = this.getValueSum(appBlue)

    const colors = {
      appRed: {
        count: appRed.length,
        value: appRedValue
      },
      appYellow: {
        count: appYellow.length,
        value: appYellowValue
      },
      appPink: {
        count: appPink.length,
        value: appPinkValue
      },
      appGreen: {
        count: appGreen.length,
        value: appGreenValue
      },
      appOrange: {
        count: appOrange.length,
        value: appOrangeValue
      },
      appBlue: {
        count: appBlue.length,
        value: appBlueValue
      }
    }
    this.colorService.onColorsChange(colors)
  }

  private getValueSum(counters: Array<Counter>) {
    let sum = bignumber(0)
    let allNull = true
    counters.forEach(counter => {
      if (counter.value != null) allNull = false
      sum = sum.plus(counter.value || bignumber(0))
    })
    return allNull ? null : sum
  }

  private setCounterActivation(counter: Counter, activate: boolean) {
    if (activate) {
      counter.active = true
      this.countersWaitingToSpin.push(counter)
    } else {
      counter.active = false
    }
  }

  private addRow(row) {
    const counters: Array<Counter> = []
    const term = triangle.term(row - 1)
    for (let i = 1; i <= row; i++) {
      const counter: Counter = {active: false, color: null, count: term + i, value: bignumber(0), pos: {row, col: i}, spin: false}
      counter.value = this.triangleCounterValueService.getCounterValue(counter, this.counterValues)
      counters.push(counter)
    }
    this.rows.push(counters)
  }

  private removeRow() {
    this.rows.pop()
  }
}
